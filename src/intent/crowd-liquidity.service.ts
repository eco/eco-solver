import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { LitActionSdkParams, SignerLike } from '@lit-protocol/types'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_ABILITY, LIT_CHAINS } from '@lit-protocol/constants'
import {
  createSiweMessage,
  generateAuthSig,
  LitActionResource,
  LitPKPResource,
} from '@lit-protocol/auth-helpers'

import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { privateKeyToAccount } from 'viem/accounts'
import {
  Hex,
  isAddressEqual,
  parseSignature,
  PublicClient,
  serializeTransaction,
  TransactionSerializableEIP1559,
} from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { CrowdLiquidityConfig, Solver } from '@/eco-configs/eco-config.types'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { getERC20Selector } from '@/contracts'
import { TokenData } from '@/liquidity-manager/types/types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceService } from '@/balance/balance.service'
import { TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'

@Injectable()
export class CrowdLiquidityService implements OnModuleInit, IFulfillService {
  private logger = new Logger(CrowdLiquidityService.name)
  private config: CrowdLiquidityConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly publicClient: MultichainPublicClientService,
    private readonly balanceService: BalanceService,
  ) {}

  onModuleInit() {
    this.config = this.ecoConfigService.getCrowdLiquidity()
  }

  /**
   * Executes the process to fulfill an intent based on the provided model and solver.
   *
   * @param {IntentSourceModel} model - The source model containing the intent and related chain information.
   * @param {Solver} solver - The solver instance used to resolve the intent.
   * @return {Promise<Hex>} A promise that resolves to the hexadecimal hash representing the result of the fulfilled intent.
   */
  executeFulfillIntent(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    if (!this.isRewardEnough(model)) {
      throw EcoError.CrowdLiquidityRewardNotEnough(model.intent.hash)
    }

    if (!this.isPoolSolvent(model)) {
      throw EcoError.CrowdLiquidityPoolNotSolvent(model.intent.hash)
    }

    return this.fulfill(Number(model.event.sourceChainID), solver.chainID, model.intent.hash)
  }

  async rebalanceCCTP(tokenIn: TokenData, tokenOut: TokenData) {
    const { kernel, pkp, actions } = this.config

    const publicClient = await this.publicClient.getClient(tokenIn.chainId)

    const [feeData, nonce] = await Promise.all([
      this.getFeeData(publicClient),
      publicClient.getTransactionCount({ address: pkp.ethAddress as Hex }),
    ])

    const transactionBase = { ...feeData, nonce, gasLimit: 1_000_000 }

    const params = {
      chainId: tokenIn.chainId,
      tokenAddress: tokenOut.config.address,
      tokenChainId: tokenOut.chainId,
      publicKey: pkp.publicKey,
      kernelAddress: kernel.address,
      transaction: transactionBase,
    }

    return this.callLitAction(actions.rebalance, publicClient, params)
  }

  /**
   * Determines if a given route.
   *
   * @param {IntentSourceModel} intentModel - The model containing intent data, including route information.
   * @return {boolean} - Returns true if the route is supported, otherwise false.
   */
  isRouteSupported(intentModel: IntentSourceModel): boolean {
    const { route, reward } = intentModel.intent
    const isSupportedReward = reward.tokens.every((item) => {
      return this.isSupportedToken(Number(route.source), item.token)
    })
    const isSupportedRoute = route.calls.every((call) => {
      const areSupportedTargetTokens = this.isSupportedToken(Number(route.destination), call.target)
      const isSupportedAction = this.isSupportedAction(call.data)
      return areSupportedTargetTokens && isSupportedAction
    })

    return isSupportedReward && isSupportedRoute
  }

  /**
   * Determines if the reward provided in the intent model is sufficient based on the route amount and the fee percentage.
   *
   * @param {IntentSourceModel} intentModel - The intent model containing the route and reward information.
   * @return {boolean} - Returns true if the total reward amount is greater than or equal to the calculated minimum required reward; otherwise, false.
   */
  isRewardEnough(intentModel: IntentSourceModel): boolean {
    const { route, reward } = intentModel.intent
    const totalRouteAmount = route.tokens.reduce((acc, token) => acc + token.amount, 0n)
    const totalRewardAmount = reward.tokens.reduce((acc, token) => acc + token.amount, 0n)

    const minimumReward = (totalRouteAmount * BigInt(this.config.feePercentage * 1e6)) / BigInt(1e6)

    return totalRewardAmount >= minimumReward
  }

  /**
   * Retrieves the list of supported tokens with their configuration details.
   *
   * @return {TokenConfig[]} Array of supported tokens, each including token details and the corresponding target balance.
   */
  getSupportedTokens(): TokenConfig[] {
    return this.balanceService
      .getInboxTokens()
      .filter((token) => this.isSupportedToken(token.chainId, token.address))
      .map((token) => ({
        ...token,
        targetBalance: this.getTokenTargetBalance(token.chainId, token.address),
      }))
  }

  /**
   * Checks if the given intent is solvent, ensuring all required token balances meet or exceed the specified amounts.
   *
   * @param {IntentSourceModel} intentModel - The intent model containing route information and token requirements.
   * @return {Promise<boolean>} - A promise that resolves to true if the intent is solvent, otherwise false.
   */
  async isPoolSolvent(intentModel: IntentSourceModel) {
    // Get supported tokens from intent
    const routeTokens = this.getSupportedTokens().filter((token) => {
      return intentModel.intent.route.tokens.some(
        (rewardToken) =>
          BigInt(token.chainId) === intentModel.intent.route.destination &&
          isAddressEqual(token.address, rewardToken.token),
      )
    })

    const routeTokensData: TokenData[] = await this.balanceService.getAllTokenDataForAddress(
      this.getPoolAddress(),
      routeTokens,
    )

    return intentModel.intent.route.tokens.every((routeToken) => {
      const token = routeTokensData.find((token) =>
        isAddressEqual(token.config.address, routeToken.token),
      )
      return token && token.balance.balance >= routeToken.amount
    })
  }

  /**
   * Checks if a token with the specified chain ID and address is supported.
   *
   * @param {number} chainId - The chain ID of the token to check.
   * @param {Hex} address - The address of the token to check.
   * @return {boolean} Returns true if the token is supported; otherwise, false.
   */
  isSupportedToken(chainId: number, address: Hex): boolean {
    return this.config.supportedTokens.some(
      (token) => isAddressEqual(token.tokenAddress, address) && token.chainId === chainId,
    )
  }

  /**
   * Checks if a token with the specified chain ID and address is supported.
   *
   * @param {number} chainId - The chain ID of the token to check.
   * @param {Hex} address - The address of the token to check.
   * @return {boolean} Returns true if the token is supported; otherwise, false.
   */
  // eslint-disable-next-line
  getTokenTargetBalance(chainId: number, address: Hex): number {
    return this.config.defaultTargetBalance
  }

  /**
   * Retrieves the pool address from the configuration.
   *
   * @return {string} The address of the pool as specified in the configuration.
   */
  getPoolAddress(): Hex {
    return this.config.kernel.address as Hex
  }

  private async fulfill(
    sourceChainId: number,
    destinationChainId: number,
    intentHash: string,
  ): Promise<Hex> {
    const { kernel, pkp, actions } = this.config

    const publicClient = await this.publicClient.getClient(destinationChainId)

    const [feeData, nonce] = await Promise.all([
      this.getFeeData(publicClient),
      publicClient.getTransactionCount({ address: pkp.ethAddress as Hex }),
    ])

    const transactionBase = { ...feeData, nonce, gasLimit: 1_000_000 }
    const sourceChainName = this.getLitNetworkFromChainId(sourceChainId)

    const params = {
      intentHash,
      publicKey: pkp.publicKey,
      sourceChainName,
      kernelAddress: kernel.address,
      transaction: transactionBase,
      ethAddress: pkp.ethAddress,
    }

    return this.callLitAction(actions.fulfill, publicClient, params)
  }

  private async callLitAction(
    ipfsId: string,
    publicClient: PublicClient,
    params: LitActionSdkParams['jsParams'],
  ): Promise<Hex> {
    const { capacityTokenId, capacityTokenOwnerPk, pkp, litNetwork } = this.config

    const litNodeClient = new LitNodeClient({
      litNetwork,
      debug: false,
    })
    await litNodeClient.connect()

    // ================ Create capacity delegation AuthSig ================

    const capacityTokenOwner = this.getViemWallet(capacityTokenOwnerPk)

    const { capacityDelegationAuthSig } = await litNodeClient.createCapacityDelegationAuthSig({
      uses: '1',
      dAppOwnerWallet: capacityTokenOwner,
      capacityTokenId: capacityTokenId,
      delegateeAddresses: [pkp.ethAddress],
      expiration: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5 minutes
    })

    // ================ Get session sigs ================

    const sessionSigs = await litNodeClient.getSessionSigs({
      pkpPublicKey: pkp.publicKey,
      chain: 'ethereum',
      capabilityAuthSigs: [capacityDelegationAuthSig],
      resourceAbilityRequests: [
        {
          resource: new LitActionResource('*'),
          ability: LIT_ABILITY.LitActionExecution,
        },
        { resource: new LitPKPResource('*'), ability: LIT_ABILITY.PKPSigning },
      ],

      authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
        const toSign = await createSiweMessage({
          uri,
          expiration,
          litNodeClient,
          resources: resourceAbilityRequests,
          walletAddress: await capacityTokenOwner.getAddress(),
          nonce: await litNodeClient.getLatestBlockhash(),
        })

        return generateAuthSig({ signer: capacityTokenOwner, toSign })
      },
    })

    // ================ Execute Lit Action ================

    const litRes = await litNodeClient.executeJs({ ipfsId, sessionSigs, jsParams: params })

    await litNodeClient.disconnect()

    // ================ Execute Transaction ================

    if (typeof litRes.response === 'string') {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing Lit action',
          properties: { ipfsId, params },
        }),
      )

      throw new Error(litRes.response)
    }

    const response = litRes.response as {
      type: number
      maxPriorityFeePerGas: string
      maxFeePerGas: string
      nonce: number
      gasLimit: number
      value: {
        type: 'BigNumber'
        hex: string
      }
      from: string
      to: string
      data: string
      chainId: number
    }

    const unsignedTransaction: TransactionSerializableEIP1559 = {
      type: 'eip1559',
      chainId: response.chainId,
      nonce: response.nonce,
      to: response.to as Hex,
      value: BigInt(response.value.hex ?? response.value ?? 0),
      data: response.data as Hex,
      gas: BigInt(response.gasLimit),
      maxFeePerGas: BigInt(response.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(response.maxPriorityFeePerGas),
    }

    const serializedTransaction = serializeTransaction(
      unsignedTransaction,
      parseSignature(litRes.signatures.sig.signature),
    )

    return publicClient.sendRawTransaction({ serializedTransaction })
  }

  /**
   * Checks if the provided data represents a supported action.
   *
   * @param {Hex} data - The data to be evaluated, which is expected to contain encoded function calls.
   * @return {boolean} Returns true if the data is a supported action; otherwise, false.
   */
  private isSupportedAction(data: Hex): boolean {
    // Only support `transfer` function calls
    return data.startsWith(getERC20Selector('transfer'))
  }

  private getViemWallet(privateKey: string): SignerLike {
    const account = privateKeyToAccount(privateKey as Hex)
    return {
      signMessage(message: string): Promise<string> {
        return account.signMessage({ message })
      },
      getAddress(): Promise<string> {
        return Promise.resolve(account.address)
      },
    }
  }

  private async getFeeData(publicClient: PublicClient) {
    const [block, maxPriorityFeePerGas] = await Promise.all([
      publicClient.getBlock(),
      publicClient.estimateMaxPriorityFeePerGas(),
    ])
    const maxFeePerGas = block.baseFeePerGas! * 2n + maxPriorityFeePerGas

    return {
      type: 2,
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
    }
  }

  private getLitNetworkFromChainId(chainID: number): keyof typeof LIT_CHAINS {
    for (const chainName in LIT_CHAINS) {
      const chain = LIT_CHAINS[chainName]
      if (chain.chainId === chainID) {
        return chainName
      }
    }
    throw new Error('Unknown chain')
  }
}
