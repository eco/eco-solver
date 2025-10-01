import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import {
  analyzeToken,
  analyzeTokenGroup,
  getSortGroupByDiff,
} from '@/liquidity-manager/utils/token'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { RebalanceJobData, RebalanceJobManager } from '@/liquidity-manager/jobs/rebalance.job'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { deserialize } from '@/common/utils/serialize'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import {
  RebalanceQuote,
  RebalanceRequest,
  TokenData,
  TokenDataAnalyzed,
} from '@/liquidity-manager/types/types'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { TokenConfig } from '@/balance/types'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { BalanceService } from '@/balance/balance.service'
import { EcoDbEntity } from '@/common/db/eco-db-entity.enum'
import { LmTxGatedKernelAccountClientService } from '../wallet-wrappers/kernel-gated-client.service'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private logger = new Logger(LiquidityManagerService.name)

  private config: LiquidityManagerConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue
  private readonly checkBalancesQueueWrapper: CheckBalancesQueue

  private readonly tokensPerWallet: Record<string, TokenConfig[]> = {}

  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
    @InjectQueue(CheckBalancesQueue.queueName)
    private readonly checkBalancesQueue: LiquidityManagerQueueType,
    @InjectFlowProducer(LiquidityManagerQueue.flowName)
    protected liquidityManagerFlowProducer: FlowProducer,
    public readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
    public readonly liquidityProviderManager: LiquidityProviderService,
    public readonly kernelAccountClientService: LmTxGatedKernelAccountClientService,
    public readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.checkBalancesQueueWrapper = new CheckBalancesQueue(this.checkBalancesQueue as any)
  }

  async onApplicationBootstrap() {
    // Remove existing job schedulers for CHECK_BALANCES (legacy + new queue)
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'CHECK_BALANCES: cleaning repeatable jobs on legacy queue',
          properties: { queue: this.queue.name },
        }),
      )
      await removeJobSchedulers(this.queue, LiquidityManagerJobName.CHECK_BALANCES)
    } catch (e) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'CHECK_BALANCES: failed to clean legacy queue schedulers',
          properties: { queue: this.queue.name, error: (e as any)?.message ?? e },
        }),
      )
    }

    // Try to remove any previous schedulers on the new queue as well (idempotent)
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'CHECK_BALANCES: cleaning repeatable jobs on dedicated queue',
          properties: { queue: this.checkBalancesQueueWrapper.name },
        }),
      )
      await removeJobSchedulers(this.checkBalancesQueue, LiquidityManagerJobName.CHECK_BALANCES)
    } catch (e) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'CHECK_BALANCES: failed to clean dedicated queue schedulers',
          properties: { error: (e as any)?.message ?? e },
        }),
      )
    }

    // Get wallet addresses we'll be monitoring
    this.config = this.ecoConfigService.getLiquidityManager()

    if (this.config.enabled !== false) {
      await this.initializeRebalances()
    }

    await this.ensureGatewayBootstrap()
  }

  private async ensureGatewayBootstrap() {
    // Gateway bootstrap deposit (simple one-time) if enabled
    try {
      // Access provider through manager; it may not be enabled in strategies, but method is safe
      const anyProvider = (this.liquidityProviderManager as any).gatewayProviderService
      if (anyProvider?.ensureBootstrapOnce) {
        await anyProvider.ensureBootstrapOnce('bootstrap')
      }
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.withError({
          message: 'Gateway bootstrap deposit skipped or failed',
          error,
        }),
      )
    }
  }

  async initializeRebalances() {
    // Use OP as the default chain assuming the Kernel wallet is the same across all chains
    const opChainId = 10
    const client = await this.kernelAccountClientService.getClient(opChainId)
    const kernelAddress = client.kernelAccount.address

    // Track rebalances for Solver
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'CHECK_BALANCES: scheduling cron (kernel wallet)',
        properties: {
          queue: this.checkBalancesQueueWrapper.name,
          intervalMs: this.config.intervalDuration,
          wallet: kernelAddress,
        },
      }),
    )
    await this.checkBalancesQueueWrapper.startCronJobs(this.config.intervalDuration, kernelAddress)
    this.tokensPerWallet[kernelAddress] = this.balanceService.getInboxTokens()

    if (this.ecoConfigService.getFulfill().type === 'crowd-liquidity') {
      // Track rebalances for Crowd Liquidity
      const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'CHECK_BALANCES: scheduling cron (crowd-liquidity pool)',
          properties: {
            queue: this.checkBalancesQueueWrapper.name,
            intervalMs: this.config.intervalDuration,
            wallet: crowdLiquidityPoolAddress,
          },
        }),
      )
      await this.checkBalancesQueueWrapper.startCronJobs(
        this.config.intervalDuration,
        crowdLiquidityPoolAddress,
      )
      this.tokensPerWallet[crowdLiquidityPoolAddress] =
        this.crowdLiquidityService.getSupportedTokens()
    }
  }

  async analyzeTokens(walletAddress: string) {
    // 1) Build reservation maps of amounts already committed to pending rebalances
    const reservedByToken = await this.getReservedByTokenMap(walletAddress)
    const incomingByToken = await this.getIncomingByTokenMap(walletAddress)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Reservation-aware analysis: reservedByToken snapshot',
        properties: {
          walletAddress,
          tokensAffected: reservedByToken.size,
          reservedByToken: Array.from(reservedByToken.entries()).map(([key, value]) => [
            key,
            value.toString(),
          ]),
        },
      }),
    )

    // 2) Fetch on-chain balances and subtract reserved amounts per token before analysis
    const tokens: TokenData[] = await this.balanceService.getAllTokenDataForAddress(
      walletAddress,
      this.tokensPerWallet[walletAddress],
    )
    const adjusted: TokenData[] = tokens.map((item) => {
      try {
        const key = `${item.chainId}:${String(item.config.address).toLowerCase()}`
        const reserved = reservedByToken.get(key) ?? 0n
        const incoming = incomingByToken.get(key) ?? 0n
        if (reserved > 0n || incoming > 0n) {
          item.balance.balance = item.balance.balance - reserved + incoming
        }
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.withError({
            message: 'Reservation-aware analysis: token skipped due to invalid config/input',
            properties: {
              walletAddress,
              token: item?.config,
            },
            error,
          }),
        )
      }
      return item
    })

    const analysis: TokenDataAnalyzed[] = []
    for (const item of adjusted) {
      try {
        analysis.push({ ...item, analysis: this.analyzeToken(item) })
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.withError({
            message: 'Reservation-aware analysis: token skipped due to invalid config/input',
            properties: {
              walletAddress,
              token: item?.config,
            },
            error,
          }),
        )
      }
    }

    const groups = groupBy(analysis, (item) => item.analysis.state)
    return {
      items: analysis,
      surplus: analyzeTokenGroup(groups[TokenState.SURPLUS] ?? []),
      inrange: analyzeTokenGroup(groups[TokenState.IN_RANGE] ?? []),
      deficit: analyzeTokenGroup(groups[TokenState.DEFICIT] ?? []),
    }
  }

  /**
   * Returns a map of reserved amounts (sum of amountIn) for tokens that are part of
   * pending rebalances for the provided wallet. Key format: `${chainId}:${tokenAddressLowercase}`
   */
  private async getReservedByTokenMap(walletAddress: string): Promise<Map<string, bigint>> {
    try {
      const map = await this.rebalanceRepository.getPendingReservedByTokenForWallet(walletAddress)
      if (map.size) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Reservation-aware analysis: applied reserved amounts',
            properties: { walletAddress, tokensAffected: map.size },
          }),
        )
      }
      return map
    } catch (error) {
      this.logger.debug(
        EcoLogMessage.withError({
          message: 'Reservation-aware analysis: no reservations applied',
          properties: { walletAddress },
          error,
        }),
      )
      return new Map<string, bigint>()
    }
  }

  /**
   * Returns a map of incoming in-flight amounts (sum of amountOut) for tokens that are part of
   * pending rebalances for the provided wallet. Key format: `${chainId}:${tokenAddressLowercase}`
   */
  private async getIncomingByTokenMap(walletAddress: string): Promise<Map<string, bigint>> {
    try {
      const map = await this.rebalanceRepository.getPendingIncomingByTokenForWallet(walletAddress)
      if (map.size) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Reservation-aware analysis: applied incoming amounts',
            properties: { walletAddress, tokensAffected: map.size },
          }),
        )
      }
      return map
    } catch (error) {
      this.logger.debug(
        EcoLogMessage.withError({
          message: 'Reservation-aware analysis: no incoming applied',
          properties: { walletAddress },
          error,
        }),
      )
      return new Map<string, bigint>()
    }
  }

  analyzeToken(token: TokenData) {
    return analyzeToken(token.config, token.balance, {
      up: this.config.thresholds.surplus,
      down: this.config.thresholds.deficit,
      targetSlippage: this.config.targetSlippage,
    })
  }

  /**
   * Gets the optimized rebalancing for the deficit and surplus tokens.
   * @dev The rebalancing is more efficient if done within the same chain.
   *      If it's not possible, other chains are considered.
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   */
  async getOptimizedRebalancing(
    walletAddress: string,
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
  ) {
    // Phase 1: same-chain first
    const sameChain = surplusTokens.filter((t) => t.config.chainId === deficitToken.config.chainId)
    const sameChainQuotes = await this.getRebalancingQuotes(walletAddress, deficitToken, sameChain)

    // Compute post-same-chain balance
    const sameOutTotal = sameChainQuotes.reduce<bigint>((acc, quote) => {
      return this.quoteTargetsDeficitToken(quote, deficitToken) ? acc + quote.amountOut : acc
    }, 0n)
    const targetMin = deficitToken.analysis.targetSlippage.min
    const currentAfterSame = deficitToken.analysis.balance.current + sameOutTotal

    if (currentAfterSame >= targetMin) {
      return sameChainQuotes
    }

    // Phase 2: cross-chain for the remaining amount in the same run
    const crossChain = surplusTokens.filter((t) => t.config.chainId !== deficitToken.config.chainId)
    const crossChainQuotes = await this.getRebalancingQuotes(
      walletAddress,
      deficitToken,
      crossChain,
      { startingCurrentBalance: currentAfterSame },
    )

    return [...sameChainQuotes, ...crossChainQuotes]
  }

  startRebalancing(walletAddress: string, rebalances: RebalanceRequest[]) {
    if (rebalances.length === 0) {
      return
    }

    const jobs = rebalances.map((rebalance) =>
      RebalanceJobManager.createJob(walletAddress, rebalance, this.liquidityManagerQueue.name),
    )

    return this.liquidityManagerFlowProducer.add({
      name: 'rebalance-batch',
      queueName: this.liquidityManagerQueue.name,
      children: jobs,
    })
  }

  async executeRebalancing(rebalanceData: RebalanceJobData) {
    const { walletAddress, rebalance } = rebalanceData
    const results = await Promise.allSettled(
      rebalance.quotes.map((quote) =>
        this.liquidityProviderManager.execute(walletAddress, deserialize(quote)),
      ),
    )

    const rejected = results.filter((r: any) => r.status === 'rejected')
    if (rejected.length) {
      throw new Error(rejected.map((r: any) => r.reason).join(', '))
    }

    return results
  }

  async storeRebalancing(walletAddress: string, request: RebalanceRequest) {
    const groupID = EcoDbEntity.REBALANCE_JOB_GROUP.getEntityID()

    for (const quote of request.quotes) {
      // Skip invalid quotes which could lead to bogus DB entries
      if (quote.amountIn <= 0n || quote.amountOut <= 0n) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'Skipping storing invalid rebalance quote',
            properties: {
              walletAddress,
              strategy: quote.strategy,
              amountIn: quote.amountIn.toString(),
              amountOut: quote.amountOut.toString(),
            },
          }),
        )
        continue
      }

      quote.groupID = groupID
      quote.rebalanceJobID = EcoDbEntity.REBALANCE_JOB.getEntityID()

      await this.rebalanceRepository.create({
        rebalanceJobID: quote.rebalanceJobID,
        groupId: quote.groupID,
        wallet: walletAddress,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        slippage: quote.slippage,
        strategy: quote.strategy,
        context: quote.context,
        tokenIn: RebalanceTokenModel.fromTokenData(quote.tokenIn),
        tokenOut: RebalanceTokenModel.fromTokenData(quote.tokenOut),
        status: RebalanceStatus.PENDING.toString(),
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Rebalance stored',
          properties: { quote, walletAddress },
        }),
      )
    }
  }

  /**
   * Checks if a rebalancing is possible between the deficit and surplus tokens.
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  private async getRebalancingQuotes(
    walletAddress: string,
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
    options?: { startingCurrentBalance?: bigint },
  ) {
    if (!Array.isArray(surplusTokens) || surplusTokens.length === 0) {
      return []
    }

    const sortedSurplusTokens = getSortGroupByDiff(surplusTokens)

    const quotes: RebalanceQuote[] = []
    let currentBalance: bigint =
      options?.startingCurrentBalance ?? deficitToken.analysis.balance.current

    // Precompute thresholds
    const targetMin = deficitToken.analysis.targetSlippage.min
    const minTradeBase6 = this.config?.minTradeBase6
    const minTradeTokens = minTradeBase6 ? Number(minTradeBase6) / 1_000_000 : 0 // stables (base-6)

    // First try all direct routes from surplus tokens to deficit token
    for (const surplusToken of sortedSurplusTokens) {
      let swapAmount = 0
      try {
        // Calculate remaining needed amount in tokens (approx):
        const remainingBaseUnits = currentBalance < targetMin ? targetMin - currentBalance : 0n
        // All tokens are base-6: convert base units to tokens directly
        const remainingTokens = Number(remainingBaseUnits) / 1_000_000

        // Calculate the amount to swap (tokens)
        swapAmount = Math.min(remainingTokens, surplusToken.analysis.diff)

        // Skip zero/negative swap amounts
        if (!Number.isFinite(swapAmount) || swapAmount <= 0) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: 'Skipping quote for zero/negative swapAmount',
              properties: {
                swapAmount,
                surplusToken: surplusToken.config,
                deficitToken: deficitToken.config,
              },
            }),
          )
          continue
        }

        // Skip dust trades below global threshold (base-6 tokens)
        if (minTradeTokens > 0 && swapAmount < minTradeTokens) {
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'Skipping quote below global minTradeBase6 threshold',
              properties: {
                swapAmount,
                minTradeBase6,
                surplusToken: surplusToken.config,
                deficitToken: deficitToken.config,
              },
            }),
          )
          continue
        }

        const strategyQuotes = await this.liquidityProviderManager.getQuote(
          walletAddress,
          surplusToken,
          deficitToken,
          swapAmount,
        )

        this.logger.log(
          EcoLogMessage.fromDefault({
            message: 'Quotes from strategies',
            properties: {
              strategyQuotes,
              surplusToken,
              deficitToken,
              swapAmount,
              walletAddress,
            },
          }),
        )

        for (const quote of strategyQuotes) {
          quotes.push(quote)
          if (this.quoteTargetsDeficitToken(quote, deficitToken)) {
            currentBalance += quote.amountOut
            if (currentBalance >= targetMin) break
          }
        }

        if (currentBalance >= targetMin) break
      } catch (error) {
        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.LIQUIDITY_MANAGER.QUOTE_ROUTE_ERROR, error, {
          surplusToken: surplusToken.config,
          deficitToken: deficitToken.config,
          swapAmount,
          walletAddress,
          operation: 'direct_route_quote',
          service: this.constructor.name,
        })

        this.logger.debug(
          EcoLogMessage.withError({
            message: 'Direct route failed',
            properties: {
              surplusToken: surplusToken.config,
              deficitToken: deficitToken.config,
            },
            error,
          }),
        )
      }
    }

    return quotes
  }

  private quoteTargetsDeficitToken(
    quote: RebalanceQuote,
    deficitToken: TokenDataAnalyzed,
  ): boolean {
    const tokenOut = quote?.tokenOut
    if (!tokenOut?.config) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Skipping quote for invalid quote tokenOut config',
          properties: {
            quote,
            deficitToken,
          },
        }),
      )
      return false
    }

    const quoteAddress = tokenOut.config.address?.toLowerCase?.()
    const targetAddress = deficitToken.config.address?.toLowerCase?.()

    return (
      !!quoteAddress &&
      !!targetAddress &&
      tokenOut.chainId === deficitToken.config.chainId &&
      quoteAddress === targetAddress
    )
  }
}
