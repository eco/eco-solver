import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { LitActionSdkParams, SignerLike } from '@lit-protocol/types'
import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LIT_ABILITY } from '@lit-protocol/constants'
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
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { TokenConfig } from '@/balance/types/balance.types'
import { EcoError } from '@/common/errors/eco-error'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoAnalyticsService } from '@/analytics'

@Injectable()
export class CrowdLiquidityService implements OnModuleInit, IFulfillService {
  private logger = new Logger(CrowdLiquidityService.name)
  private config: CrowdLiquidityConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly publicClient: MultichainPublicClientService,
    private readonly rpcBalanceService: RpcBalanceService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoAnalytics: EcoAnalyticsService,
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
  async fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    const startTime = Date.now()

    try {
      if (!this.isRewardEnough(model)) {
        const error = EcoError.CrowdLiquidityRewardNotEnough(model.intent.hash)
        this.ecoAnalytics.trackCrowdLiquidityFulfillmentRewardNotEnough(model, solver, error)
        throw error
      }

      if (!(await this.isPoolSolvent(model))) {
        const error = EcoError.CrowdLiquidityPoolNotSolvent(model.intent.hash)
        this.ecoAnalytics.trackCrowdLiquidityFulfillmentPoolNotSolvent(model, solver, error)
        throw error
      }

      // Set status to CL_PROCESSING before attempting fulfillment
      model.status = 'CL_PROCESSING'
      await this.utilsIntentService.updateIntentModel(model)

      try {
        const transactionHash = await this._fulfill(model.intent)

        // Set status to SOLVED and store transaction hash as receipt
        model.status = 'CL_SOLVED'
        model.fulfilledBySelf = false // Mark as fulfilled by external crowd liquidity
        model.receipt = { transactionHash } as any
        await this.utilsIntentService.updateIntentModel(model)

        const processingTime = Date.now() - startTime
        this.ecoAnalytics.trackCrowdLiquidityFulfillmentSuccess(
          model,
          solver,
          transactionHash,
          processingTime,
        )
        return transactionHash
      } catch (error) {
        // Set status to FAILED and store error as receipt
        model.status = 'CL_FAILED'
        model.receipt = { error: error.message || error } as any
        await this.utilsIntentService.updateIntentModel(model)

        throw error
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.ecoAnalytics.trackCrowdLiquidityFulfillmentFailed(model, solver, error, processingTime)
      throw error
    }
  }

  async rebalanceCCTP(tokenIn: TokenData, tokenOut: TokenData) {
    try {
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

      const result = await this.callLitAction(actions.rebalance, publicClient, params)
      this.ecoAnalytics.trackCrowdLiquidityRebalanceSuccess(tokenIn, tokenOut, result)
      return result
    } catch (error) {
      this.ecoAnalytics.trackCrowdLiquidityRebalanceError(tokenIn, tokenOut, error)
      throw error
    }
  }

  /**
   * Determines if a given route.
   *
   * @param {IntentSourceModel} intentModel - The model containing intent data, including route information.
   * @return {boolean} - Returns true if the route is supported, otherwise false.
   */
  isRouteSupported(intentModel: IntentSourceModel): boolean {
    this.ecoAnalytics.trackCrowdLiquidityRouteSupportCheck(intentModel)

    const { route, reward } = intentModel.intent
    const isSupportedReward = reward.tokens.every((item) => {
      return this.isSupportedToken(Number(route.source), item.token)
    })
    const isSupportedRoute = route.calls.every((call) => {
      const areSupportedTargetTokens = this.isSupportedToken(Number(route.destination), call.target)
      const isSupportedAction = this.isSupportedAction(call.data)
      return areSupportedTargetTokens && isSupportedAction
    })

    const isSupported = isSupportedReward && isSupportedRoute
    this.ecoAnalytics.trackCrowdLiquidityRouteSupportResult(intentModel, isSupported, {
      isSupportedReward,
      isSupportedRoute,
    })

    return isSupported
  }

  /**
   * Determines if the reward provided in the intent model is sufficient based on the route amount and the fee percentage.
   *
   * @param {IntentSourceModel} intentModel - The intent model containing the route and reward information.
   * @return {boolean} - Returns true if the total reward amount is greater than or equal to the calculated minimum required reward; otherwise, false.
   */
  isRewardEnough(intentModel: IntentSourceModel): boolean {
    this.ecoAnalytics.trackCrowdLiquidityRewardCheck(intentModel)

    const { route, reward } = intentModel.intent
    const totalRouteAmount = route.tokens.reduce((acc, token) => acc + token.amount, 0n)
    const totalRewardAmount = reward.tokens.reduce((acc, token) => acc + token.amount, 0n)

    const minimumReward = (totalRouteAmount * BigInt(this.config.feePercentage * 1e6)) / BigInt(1e6)
    const isEnough = totalRewardAmount >= minimumReward

    this.ecoAnalytics.trackCrowdLiquidityRewardCheckResult(intentModel, isEnough, {
      totalRouteAmount: totalRouteAmount.toString(),
      totalRewardAmount: totalRewardAmount.toString(),
      minimumReward: minimumReward.toString(),
      feePercentage: this.config.feePercentage,
    })

    return isEnough
  }

  /**
   * Retrieves the list of supported tokens with their configuration details.
   *
   * @return {TokenConfig[]} Array of supported tokens, each including token details and the corresponding target balance.
   */
  getSupportedTokens(): TokenConfig[] {
    return this.ecoConfigService
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
    try {
      // Get supported tokens from intent
      const routeTokens = this.getSupportedTokens().filter((token) => {
        return intentModel.intent.route.tokens.some(
          (rewardToken) =>
            BigInt(token.chainId) === intentModel.intent.route.destination &&
            isAddressEqual(token.address, rewardToken.token),
        )
      })

      const routeTokensData: TokenData[] = await this.rpcBalanceService.getAllTokenDataForAddress(
        this.getPoolAddress(),
        routeTokens,
      )

      const isSolvent = intentModel.intent.route.tokens.every((routeToken) => {
        const token = routeTokensData.find((token) =>
          isAddressEqual(token.config.address, routeToken.token),
        )
        return token && token.balance.balance >= routeToken.amount
      })

      this.ecoAnalytics.trackCrowdLiquidityPoolSolvencyResult(intentModel, isSolvent, {
        routeTokens: routeTokens.length,
        routeTokensData: routeTokensData.length,
        poolAddress: this.getPoolAddress(),
      })

      return isSolvent
    } catch (error) {
      this.ecoAnalytics.trackCrowdLiquidityPoolSolvencyError(intentModel, error)
      throw error
    }
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

  private async _fulfill(intentModel: IntentDataModel): Promise<Hex> {
    const { kernel, pkp, actions } = this.config

    const publicClient = await this.publicClient.getClient(Number(intentModel.route.destination))

    const [feeData, nonce] = await Promise.all([
      this.getFeeData(publicClient),
      publicClient.getTransactionCount({ address: pkp.ethAddress as Hex }),
    ])

    const transactionBase = { ...feeData, nonce, gasLimit: 1_000_000 }

    // Serialize intent
    const intent = {
      route: {
        salt: intentModel.route.salt,
        source: Number(intentModel.route.source),
        destination: Number(intentModel.route.destination),
        inbox: intentModel.route.inbox,
        calls: intentModel.route.calls.map((call) => ({
          target: call.target,
          data: call.data,
          value: call.value.toString(),
        })),
        tokens: intentModel.route.tokens.map((t) => ({
          token: t.token,
          amount: t.amount.toString(),
        })),
      },
      reward: {
        creator: intentModel.reward.creator,
        prover: intentModel.reward.prover,
        deadline: intentModel.reward.deadline.toString(),
        nativeValue: intentModel.reward.nativeValue.toString(),
        tokens: intentModel.reward.tokens.map((t) => ({
          token: t.token,
          amount: t.amount.toString(),
        })),
      },
    }

    const params = {
      intent,
      publicKey: pkp.publicKey,
      kernelAddress: kernel.address,
      transaction: transactionBase,
    }

    return this.callLitAction(actions.fulfill, publicClient, params)
  }

  private async callLitAction(
    ipfsId: string,
    publicClient: PublicClient,
    params: LitActionSdkParams['jsParams'],
  ): Promise<Hex> {
    try {
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

        const error = new Error(litRes.response)
        this.ecoAnalytics.trackCrowdLiquidityLitActionError(ipfsId, params, error)
        throw error
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

      const result = await publicClient.sendRawTransaction({ serializedTransaction })
      this.ecoAnalytics.trackCrowdLiquidityLitActionSuccess(ipfsId, params, result)
      return result
    } catch (error) {
      this.ecoAnalytics.trackCrowdLiquidityLitActionError(ipfsId, params, error)
      throw error
    }
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
}
