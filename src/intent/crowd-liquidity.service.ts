import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
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
import { encodeAbiParameters, Hex, isAddressEqual, pad, publicActions, zeroAddress } from 'viem'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { getChainConfig } from '@/eco-configs/utils'
import { CrowdLiquidityConfig } from '@/eco-configs/eco-config.types'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { getERC20Selector } from '@/contracts'
import { TokenData } from '@/liquidity-manager/types/types'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceService } from '@/balance/balance.service'
import { TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { EcoAnalyticsService } from '@/analytics'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { stablePoolAbi } from '@/contracts/StablePool'
import { hashIntent, IMessageBridgeProverAbi, IntentType } from '@eco-foundation/routes-ts'
import {
  FulfillActionArgs,
  FulfillActionResponse,
} from '@/intent/interfaces/fulfill-action-response.interface'
import { convertBigIntsToStrings } from '@/common/viem/utils'

@Injectable()
export class CrowdLiquidityService implements OnModuleInit, IFulfillService {
  private logger = new Logger(CrowdLiquidityService.name)
  private config: CrowdLiquidityConfig

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly walletClientService: WalletClientDefaultSignerService,
  ) {}

  onModuleInit() {
    this.config = this.configService.getCrowdLiquidity()
  }

  /**
   * Executes the process to fulfill an intent based on the provided model and solver.
   *
   * @param {IntentSourceModel} intentModel - The source model containing the intent and related chain information.
   * @return {Promise<Hex>} A promise that resolves to the hexadecimal hash representing the result of the fulfilled intent.
   */
  async fulfill(intentModel: IntentSourceModel): Promise<Hex> {
    const startTime = Date.now()

    const totalRouteAmount = intentModel.intent.route.tokens.reduce(
      (acc, token) => acc + token.amount,
      0n,
    )

    try {
      const executionFee = await this.getExecutionFee(intentModel.intent, totalRouteAmount)

      const isRewardEnough = await this.isRewardEnough(intentModel, totalRouteAmount, executionFee)
      if (!isRewardEnough) {
        const error = EcoError.CrowdLiquidityRewardNotEnough(intentModel.intent.hash)
        this.ecoAnalytics.trackCrowdLiquidityFulfillmentRewardNotEnough(intentModel, error)
        throw error
      }

      const isPoolSolvent = await this.isPoolSolvent(intentModel)
      if (!isPoolSolvent) {
        const error = EcoError.CrowdLiquidityPoolNotSolvent(intentModel.intent.hash)
        this.ecoAnalytics.trackCrowdLiquidityFulfillmentPoolNotSolvent(intentModel, error)
        throw error
      }

      const { pkp, actions } = this.config

      // Serialize intent
      const intent = this.getIntentType(intentModel.intent)

      // Convert all bigints to strings
      const serializedStringIntent = convertBigIntsToStrings(intent)
      const serializedIntent: FulfillActionArgs['intent'] = {
        route: {
          ...serializedStringIntent.route,
          source: Number(serializedStringIntent.route.source),
          destination: Number(serializedStringIntent.route.destination),
        },
        reward: {
          ...serializedStringIntent.reward,
          deadline: Number(serializedStringIntent.reward.deadline),
        },
      }

      const poolData = await this.callLitAction<FulfillActionArgs, FulfillActionResponse>(
        actions.fulfill,
        { intent: serializedIntent, publicKey: pkp.publicKey },
      )

      const { rewardHash, intentHash } = hashIntent(intent)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Crowd liquidity: Pool data',
          properties: { poolData, intentHash },
        }),
      )

      const proverFee = await this.getProverFee(intentModel.intent)
      const { source, destination, messageData } = this.getProverData(intentModel.intent)
      const { intentSource } = this.getAddresses(source)

      const walletClient = await this.walletClientService.getClient(destination)
      const publicClient = walletClient.extend(publicActions)

      const hash = await walletClient.writeContract({
        address: this.getAddresses(destination).stablePool,
        abi: stablePoolAbi,
        functionName: 'fulfillAndProve',
        value: proverFee,
        args: [
          intentHash,
          intent.route,
          rewardHash,
          intentSource,
          poolData.rewardVault,
          poolData.vaultClaimant,
          BigInt(poolData.vaultAmount),
          BigInt(poolData.vaultFee),
          BigInt(poolData.ttl),
          poolData.prover,
          messageData,
          poolData.signature,
        ],
      })

      await publicClient.waitForTransactionReceipt({ hash })

      const processingTime = Date.now() - startTime
      this.ecoAnalytics.trackCrowdLiquidityFulfillmentSuccess(intentModel, hash, processingTime)

      return hash
    } catch (error) {
      const processingTime = Date.now() - startTime
      this.ecoAnalytics.trackCrowdLiquidityFulfillmentFailed(intentModel, error, processingTime)
      throw error
    }
  }

  // eslint-disable-next-line
  async rebalanceCCTP(tokenIn: TokenData, tokenOut: TokenData): Promise<Hex> {
    // This rebalancing route should be disabled in the AWS config for now. It's TBD whether we'll continue supporting it; we'll probably replace it with the negative intents.
    throw new Error('Unimplemented')
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
    try {
      // Get supported tokens from intent
      const routeTokens = this.getSupportedTokens().filter((token) => {
        return intentModel.intent.route.tokens.some(
          (rewardToken) =>
            BigInt(token.chainId) === intentModel.intent.route.destination &&
            isAddressEqual(token.address, rewardToken.token),
        )
      })

      const { stablePool: poolAddress } = this.getAddresses(
        Number(intentModel.intent.route.destination),
      )

      const routeTokensData: TokenData[] = await this.balanceService.getAllTokenDataForAddress(
        poolAddress,
        routeTokens,
      )

      const isSolvent = intentModel.intent.route.tokens.every((routeToken) => {
        const token = routeTokensData.find((token) =>
          isAddressEqual(token.config.address, routeToken.token),
        )
        return token && token.balance.balance >= routeToken.amount
      })

      this.ecoAnalytics.trackCrowdLiquidityPoolSolvencyResult(intentModel, isSolvent, {
        poolAddress,
        routeTokens: routeTokens.length,
        routeTokensData: routeTokensData.length,
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
   * Get pool address by chain ID.
   * @param chainID Chain ID
   */
  getAddresses(chainID: number) {
    const intentSourceConfig = this.configService.getIntentSource(chainID)
    if (!intentSourceConfig) throw EcoError.IntentSourceNotFound(chainID)
    const { stablePoolAddress: stablePool, sourceAddress: intentSource } = intentSourceConfig
    if (!stablePool) throw new Error(`Stable pool not present on chain id ${chainID}`)
    return { stablePool, intentSource }
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
   * @param totalRouteAmount
   * @param executionFee
   * @return {boolean} - Returns true if the total reward amount is greater than or equal to the calculated minimum required reward; otherwise, false.
   */
  async isRewardEnough(
    intentModel: IntentSourceModel,
    totalRouteAmount: bigint,
    executionFee: bigint,
  ): Promise<boolean> {
    this.ecoAnalytics.trackCrowdLiquidityRewardCheck(intentModel)

    const totalRewardAmount = intentModel.intent.reward.tokens.reduce(
      (acc, token) => acc + token.amount,
      0n,
    )

    const minimumReward = totalRouteAmount + executionFee
    const isEnough = totalRewardAmount >= minimumReward

    if (!isEnough) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Reward not enough for intent',
          properties: {
            totalRouteAmount: totalRouteAmount.toString(),
            totalRewardAmount: totalRewardAmount.toString(),
            minimumReward: minimumReward.toString(),
            executionFee: executionFee.toString(),
          },
        }),
      )
    }

    this.ecoAnalytics.trackCrowdLiquidityRewardCheckResult(intentModel, isEnough, {
      totalRouteAmount: totalRouteAmount.toString(),
      totalRewardAmount: totalRewardAmount.toString(),
      executionFee: executionFee.toString(),
      minimumReward: minimumReward.toString(),
    })

    return isEnough
  }

  public async getExecutionFee(
    intentModel: IntentDataModel,
    totalRouteAmount: bigint,
  ): Promise<bigint> {
    const destinationChainID = Number(intentModel.route.destination)

    // Excess fee
    const excessFee = BigInt(this.config.minExcessFees[destinationChainID] ?? '0')

    // Bridging fee
    const { stablePool } = this.getAddresses(destinationChainID)
    const { bridgingFeeBps } = await this.getPoolFees(destinationChainID, stablePool)
    const bridgingFee = (totalRouteAmount * bridgingFeeBps.multiplier) / bridgingFeeBps.base

    return bridgingFee + excessFee
  }

  @Cacheable()
  protected async getPoolFees(chainID: number, poolAddr: Hex) {
    const walletClient = await this.walletClientService.getClient(chainID)
    const publicClient = walletClient.extend(publicActions)

    // The contract uses BPS as an integer to represent percentage where `50` equals 0.5%
    // This is a constant value in the contract that cannot be read from it.
    const bridgingFeeBpsBase = 100n

    const bridgingFeeBps = await publicClient.readContract({
      address: poolAddr,
      abi: stablePoolAbi,
      functionName: 'bridgingFeeBps',
    })

    return { bridgingFeeBps: { multiplier: bridgingFeeBps, base: bridgingFeeBpsBase } }
  }

  getProverData(intentModel: IntentDataModel) {
    const messageData = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
      [pad(intentModel.reward.prover), '0x', zeroAddress],
    )

    const source = Number(intentModel.route.source)
    const destination = Number(intentModel.route.destination)

    const intentHash = intentModel.hash
    const { stablePool: claimant } = this.getAddresses(source)

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

  private async callLitAction<
    Params extends LitActionSdkParams['jsParams'],
    Response extends { signature: string } = { signature: string },
  >(ipfsId: string, params: Params): Promise<Response> {
    try {
      const { capacityTokenOwnerPk, pkp, litNetwork } = this.config

      const litNodeClient = new LitNodeClient({ litNetwork, debug: false })
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

        const error = new Error(litRes.response)
        this.ecoAnalytics.trackCrowdLiquidityLitActionError(ipfsId, params, error)
        throw error
      }

      const result = {
        ...litRes.response,
        signature: litRes.signatures.sig.signature as string,
      } as Response

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
