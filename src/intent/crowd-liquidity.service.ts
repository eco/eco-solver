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
  encodeAbiParameters,
  Hex,
  isAddressEqual,
  pad,
  parseUnits,
  publicActions,
  zeroAddress,
} from 'viem'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { getChainConfig } from '@/eco-configs/utils'
import { CrowdLiquidityConfig } from '@/eco-configs/eco-config.types'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { getERC20Selector } from '@/contracts'
import { TokenData } from '@/liquidity-manager/types/types'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { getEthPrice } from '@/common/coingecko/api'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceService } from '@/balance/balance.service'
import { TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { stablePoolAbi } from '@/contracts/StablePool'
import { hashIntent, IMessageBridgeProverAbi, IntentType } from '@eco-foundation/routes-ts'
import {
  FulfillActionArgs,
  FulfillActionResponse,
} from '@/intent/interfaces/fulfill-action-response.interface'

@Injectable()
export class CrowdLiquidityService implements OnModuleInit, IFulfillService {
  private logger = new Logger(CrowdLiquidityService.name)
  private config: CrowdLiquidityConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly walletClientService: WalletClientDefaultSignerService,
  ) {}

  onModuleInit() {
    this.config = this.ecoConfigService.getCrowdLiquidity()
  }

  /**
   * Executes the process to fulfill an intent based on the provided model and solver.
   *
   * @param {IntentSourceModel} model - The source model containing the intent and related chain information.
   * @return {Promise<Hex>} A promise that resolves to the hexadecimal hash representing the result of the fulfilled intent.
   */
  async fulfill(model: IntentSourceModel): Promise<Hex> {
    const isRewardEnough = await this.isRewardEnough(model)
    if (!isRewardEnough) {
      throw EcoError.CrowdLiquidityRewardNotEnough(model.intent.hash)
    }

    const isPoolSolver = await this.isPoolSolvent(model)
    if (!isPoolSolver) {
      throw EcoError.CrowdLiquidityPoolNotSolvent(model.intent.hash)
    }

    return this._fulfill(model.intent)
  }

  // eslint-disable-next-line
  async rebalanceCCTP(tokenIn: TokenData, tokenOut: TokenData): Promise<Hex> {
    throw new Error('Unimplemented')

    // const { pkp, actions } = this.config
    //
    // const publicClient = await this.publicClient.getClient(tokenIn.chainId)
    //
    // const params = {
    //   publicKey: pkp.publicKey,
    //   intent,
    // }
    //
    // return this.callLitAction<FulfillActionArgs, FulfillActionResponse>(actions.rebalance, params)
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
        targetBalance: this.config.defaultTargetBalance,
      }))
  }

  /**
   * Checks if the given intent is solvent, ensuring all required token balances meet or exceed the specified amounts.
   *
   * @param {IntentSourceModel} intentModel - The intent model containing route information and token requirements.
   * @return {Promise<boolean>} - A promise that resolves to true if the intent is solvent, otherwise false.
   */
  async isPoolSolvent(intentModel: IntentSourceModel): Promise<boolean> {
    // Get supported tokens from intent
    const routeTokens = this.getSupportedTokens().filter((token) => {
      return intentModel.intent.route.tokens.some(
        (rewardToken) =>
          BigInt(token.chainId) === intentModel.intent.route.destination &&
          isAddressEqual(token.address, rewardToken.token),
      )
    })

    const routeTokensData: TokenData[] = await this.balanceService.getAllTokenDataForAddress(
      this.getPoolAddress(Number(intentModel.intent.route.destination)),
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
   * Get pool address by chain ID.
   * @param chainID Chain ID
   */
  getPoolAddress(chainID: number): Hex {
    const intentSource = this.ecoConfigService.getIntentSource(chainID)
    if (!intentSource) throw EcoError.IntentSourceNotFound(chainID)
    if (!intentSource.stablePoolAddress)
      throw new Error(`Stable pool not present on chain id ${chainID}`)
    return intentSource.stablePoolAddress
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
  async isRewardEnough(intentModel: IntentSourceModel): Promise<boolean> {
    const { route, reward } = intentModel.intent
    const totalRouteAmount = route.tokens.reduce((acc, token) => acc + token.amount, 0n)
    const totalRewardAmount = reward.tokens.reduce((acc, token) => acc + token.amount, 0n)

    const executionFee = await this.getExecutionFee(intentModel.intent, totalRouteAmount)

    return totalRewardAmount >= totalRouteAmount + executionFee
  }

  protected async _fulfill(intentModel: IntentDataModel): Promise<Hex> {
    const { pkp, actions } = this.config

    // Serialize intent
    const intent = this.getIntentType(intentModel)

    const poolData = await this.callLitAction<FulfillActionArgs, FulfillActionResponse>(
      actions.fulfill,
      { intent, publicKey: pkp.publicKey },
    )

    const { destination, messageData } = this.getProverData(intentModel)

    const walletClient = await this.walletClientService.getClient(destination)
    const publicClient = walletClient.extend(publicActions)

    const { rewardHash, intentHash } = hashIntent(intent)

    const hash = await walletClient.writeContract({
      address: this.getPoolAddress(destination),
      abi: stablePoolAbi,
      functionName: 'fulfillAndProve',
      args: [
        intent.route,
        rewardHash,
        poolData.rewardVault,
        intentHash,
        poolData.localProver,
        BigInt(poolData.ttl),
        messageData,
        poolData.signature,
      ],
    })

    await publicClient.waitForTransactionReceipt({ hash })

    return hash
  }

  protected async getExecutionFee(
    intentModel: IntentDataModel,
    totalRouteAmount: bigint,
  ): Promise<bigint> {
    const destinationChainID = Number(intentModel.route.destination)
    const poolAddr = this.getPoolAddress(destinationChainID)

    const { ethPrice, bridgingFeeBps } = await this.getPoolFees(destinationChainID, poolAddr)

    const bridgingFee = (totalRouteAmount * bridgingFeeBps.multiplier) / bridgingFeeBps.base

    // Prover fee is ETH, so we get the ETH price to charge this prover fee in USD
    const proverFee = await this.getProverFee(intentModel)
    const ethPriceInt = (parseUnits(ethPrice.toString(), 6) * proverFee) / BigInt(1e18)

    // TODO: Assumes 6 decimal values
    return ethPriceInt + bridgingFee
  }

  @Cacheable()
  protected async getPoolFees(chainID: number, poolAddr: Hex) {
    const walletClient = await this.walletClientService.getClient(chainID)
    const publicClient = walletClient.extend(publicActions)

    // The contract uses BPS as an integer to represent percentage where `50` equals 0.5%
    // This is a constant value in the contract that cannot be read from it.
    const bridgingFeeBpsBase = 100n

    const bridgingFeeBpsRequest = publicClient.readContract({
      address: poolAddr,
      abi: stablePoolAbi,
      functionName: 'bridgingFeeBps',
    })

    const [bridgingFeeBps, ethPrice] = await Promise.all([bridgingFeeBpsRequest, getEthPrice()])

    return { bridgingFeeBps: { multiplier: bridgingFeeBps, base: bridgingFeeBpsBase }, ethPrice }
  }

  getProverData(intentModel: IntentDataModel) {
    const messageData = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
      [pad(intentModel.reward.prover), '0x', zeroAddress],
    )

    const source = Number(intentModel.route.source)
    const destination = Number(intentModel.route.destination)

    const intentHash = intentModel.hash
    const claimant = this.getPoolAddress(source)

    const localProver = getChainConfig(destination).HyperProver

    return { messageData, intentHash, localProver, claimant, source, destination }
  }

  protected async getProverFee(intentModel: IntentDataModel) {
    const { source, destination, localProver, intentHash, claimant, messageData } =
      this.getProverData(intentModel)

    const walletClient = await this.walletClientService.getClient(destination)
    const publicClient = walletClient.extend(publicActions)

    return publicClient.readContract({
      address: localProver,
      abi: IMessageBridgeProverAbi,
      functionName: 'fetchFee',
      args: [BigInt(source), [intentHash], [claimant], messageData],
    })
  }

  private async callLitAction<Params extends LitActionSdkParams['jsParams'], Response = object>(
    ipfsId: string,
    params: Params,
  ): Promise<Response> {
    const { capacityTokenOwnerPk, pkp, litNetwork } = this.config

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

    // ================ Process response ================

    if (typeof litRes.response === 'string') {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error processing Lit action',
          properties: { ipfsId, params },
        }),
      )

      throw new Error(litRes.response)
    }

    return litRes.response as Response
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

  private getIntentType(intentModel: IntentDataModel): IntentType {
    return {
      route: {
        salt: intentModel.route.salt,
        inbox: intentModel.route.inbox,
        source: intentModel.route.source,
        destination: intentModel.route.destination,
        calls: intentModel.route.calls.map((call) => ({
          target: call.target,
          data: call.data,
          value: call.value,
        })),
        tokens: intentModel.route.tokens.map((t) => ({
          token: t.token,
          amount: t.amount,
        })),
      },
      reward: {
        creator: intentModel.reward.creator,
        prover: intentModel.reward.prover,
        deadline: intentModel.reward.deadline,
        nativeValue: intentModel.reward.nativeValue,
        tokens: intentModel.reward.tokens.map((t) => ({
          token: t.token,
          amount: t.amount,
        })),
      },
    }
  }
}
