import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import {
  analyzeToken as analyzeTokenUtil,
  analyzeTokenGroup,
  getSortGroupByDiff,
} from '@/liquidity-manager/utils/token'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import {
  LIQUIDITY_MANAGER_QUEUE_NAME,
  LIQUIDITY_MANAGER_FLOW_NAME,
  CHECK_BALANCES_QUEUE_NAME,
} from '@/liquidity-manager/constants/queue.constants'
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
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenConfig } from '@/balance/types'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext, LogSubOperation } from '@/common/logging/decorators'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { BalanceService } from '@/balance/balance.service'
import { EcoDbEntity } from '@/common/db/eco-db-entity.enum'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private logger = new LiquidityManagerLogger('LiquidityManagerService')

  private config: LiquidityManagerConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue
  private readonly checkBalancesQueueWrapper: CheckBalancesQueue

  private readonly tokensPerWallet: Record<string, TokenConfig[]> = {}

  constructor(
    @InjectQueue(LIQUIDITY_MANAGER_QUEUE_NAME)
    private readonly queue: LiquidityManagerQueueType,
    @InjectQueue(CHECK_BALANCES_QUEUE_NAME)
    private readonly checkBalancesQueue: LiquidityManagerQueueType,
    @InjectFlowProducer(LIQUIDITY_MANAGER_FLOW_NAME)
    protected liquidityManagerFlowProducer: FlowProducer,
    public readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
    public readonly liquidityProviderManager: LiquidityProviderService,
    public readonly kernelAccountClientService: KernelAccountClientService,
    public readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.checkBalancesQueueWrapper = new CheckBalancesQueue(this.checkBalancesQueue as any)
  }

  @LogOperation('application_bootstrap', LiquidityManagerLogger)
  async onApplicationBootstrap() {
    // Remove existing job schedulers for CHECK_BALANCES (legacy + new queue)
    try {
      this.logger.log(
        { rebalanceId: 'system', walletAddress: 'system', strategy: 'system' },
        'CHECK_BALANCES: cleaning repeatable jobs on legacy queue',
        { queue: this.queue.name },
      )
      await removeJobSchedulers(this.queue, LiquidityManagerJobName.CHECK_BALANCES)
    } catch (e) {
      // Business event logging - queue cleanup failure
      this.logger.logScheduledJobEvent('system', 'queue_cleanup', 'failed', {
        queue: this.queue.name,
        error: (e as any)?.message ?? e,
      })
    }

    // Try to remove any previous schedulers on the new queue as well (idempotent)
    try {
      this.logger.log(
        { rebalanceId: 'system', walletAddress: 'system', strategy: 'system' },
        'CHECK_BALANCES: cleaning repeatable jobs on dedicated queue',
        { queue: this.checkBalancesQueueWrapper.name },
      )
      await removeJobSchedulers(this.checkBalancesQueue, LiquidityManagerJobName.CHECK_BALANCES)
    } catch (e) {
      // Business event logging - dedicated queue cleanup failure
      this.logger.logScheduledJobEvent('system', 'dedicated_queue_cleanup', 'failed', {
        queue: this.checkBalancesQueueWrapper.name,
        error: (e as any)?.message ?? e,
      })
    }

    // Get wallet addresses we'll be monitoring
    this.config = this.ecoConfigService.getLiquidityManager()

    if (this.config.enabled !== false) {
      await this.initializeRebalances()
    }

    await this.ensureGatewayBootstrap()
  }

  @LogSubOperation('gateway_bootstrap')
  private async ensureGatewayBootstrap() {
    // Gateway bootstrap deposit (simple one-time) if enabled
    try {
      // Access provider through manager; it may not be enabled in strategies, but method is safe
      const anyProvider = (this.liquidityProviderManager as any).gatewayProviderService
      if (anyProvider?.ensureBootstrapOnce) {
        await anyProvider.ensureBootstrapOnce('bootstrap')
        // Business event logging - successful bootstrap
        this.logger.logProviderBootstrap('gateway', 0, true)
      }
    } catch (error) {
      // Business event logging - bootstrap failure
      this.logger.logProviderBootstrap('gateway', 0, false)
    }
  }

  @LogOperation('rebalance_initialization', LiquidityManagerLogger)
  async initializeRebalances() {
    // Use OP as the default chain assuming the Kernel wallet is the same across all chains
    const opChainId = 10
    const client = await this.kernelAccountClientService.getClient(opChainId)
    const kernelAddress = client.kernelAccount.address

    // Track rebalances for Solver
    this.logger.log(
      { rebalanceId: 'system', walletAddress: kernelAddress, strategy: 'system' },
      'CHECK_BALANCES: scheduling cron (kernel wallet)',
      {
        queue: this.checkBalancesQueueWrapper.name,
        intervalMs: this.config.intervalDuration,
      },
    )
    await this.checkBalancesQueueWrapper.startCronJobs(this.config.intervalDuration, kernelAddress)
    this.tokensPerWallet[kernelAddress] = this.balanceService.getInboxTokens()

    if (this.ecoConfigService.getFulfill().type === 'crowd-liquidity') {
      // Track rebalances for Crowd Liquidity
      const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()
      this.logger.log(
        {
          rebalanceId: 'system',
          walletAddress: crowdLiquidityPoolAddress,
          strategy: 'crowd-liquidity',
        },
        'CHECK_BALANCES: scheduling cron (crowd-liquidity pool)',
        {
          queue: this.checkBalancesQueueWrapper.name,
          intervalMs: this.config.intervalDuration,
        },
      )
      await this.checkBalancesQueueWrapper.startCronJobs(
        this.config.intervalDuration,
        crowdLiquidityPoolAddress,
      )
      this.tokensPerWallet[crowdLiquidityPoolAddress] =
        this.crowdLiquidityService.getSupportedTokens()
    }
  }

  @LogOperation('token_analysis', LiquidityManagerLogger, {
    sampling: { rate: 0.2, level: 'debug' }, // Sample token analysis for cost efficiency
  })
  async analyzeTokens(@LogContext walletAddress: string) {
    // 1) Build reservation maps of amounts already committed to pending rebalances
    const reservedByToken = await this.getReservedByTokenMap(walletAddress)
    const incomingByToken = await this.getIncomingByTokenMap(walletAddress)

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
      } catch (error) {}
      return item
    })

    const analysis: TokenDataAnalyzed[] = []
    for (const item of adjusted) {
      try {
        analysis.push({ ...item, analysis: this.analyzeToken(item) })
      } catch (error) {}
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
  @LogSubOperation('reserved_token_mapping')
  private async getReservedByTokenMap(walletAddress: string): Promise<Map<string, bigint>> {
    try {
      const map = await this.rebalanceRepository.getPendingReservedByTokenForWallet(walletAddress)
      return map
    } catch (error) {
      return new Map<string, bigint>()
    }
  }

  /**
   * Returns a map of incoming in-flight amounts (sum of amountOut) for tokens that are part of
   * pending rebalances for the provided wallet. Key format: `${chainId}:${tokenAddressLowercase}`
   */
  @LogSubOperation('incoming_token_mapping')
  private async getIncomingByTokenMap(walletAddress: string): Promise<Map<string, bigint>> {
    try {
      const map = await this.rebalanceRepository.getPendingIncomingByTokenForWallet(walletAddress)
      return map
    } catch (error) {
      return new Map<string, bigint>()
    }
  }

  analyzeToken(token: TokenData) {
    return analyzeTokenUtil(token.config, token.balance, {
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
  @LogOperation('optimized_rebalancing', LiquidityManagerLogger)
  async getOptimizedRebalancing(
    @LogContext walletAddress: string,
    @LogContext deficitToken: TokenDataAnalyzed,
    @LogContext surplusTokens: TokenDataAnalyzed[],
  ) {
    // Phase 1: same-chain first
    const sameChain = surplusTokens.filter((t) => t.config.chainId === deficitToken.config.chainId)
    let sameChainQuotes: RebalanceQuote[] = []
    if (sameChain.length > 0) {
      sameChainQuotes = await this.getRebalancingQuotes(walletAddress, deficitToken, sameChain)
    }

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
    let crossChainQuotes: RebalanceQuote[] = []
    if (crossChain.length > 0) {
      crossChainQuotes = await this.getRebalancingQuotes(walletAddress, deficitToken, crossChain, {
        startingCurrentBalance: currentAfterSame,
      })
    }

    return [...sameChainQuotes, ...crossChainQuotes]
  }

  @LogOperation('rebalance_start', LiquidityManagerLogger)
  startRebalancing(@LogContext walletAddress: string, @LogContext rebalances: RebalanceRequest[]) {
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

  @LogOperation('rebalance_execution', LiquidityManagerLogger)
  async executeRebalancing(@LogContext rebalanceData: RebalanceJobData) {
    const { walletAddress, rebalance } = rebalanceData
    for (const quote of rebalance.quotes) {
      await this.liquidityProviderManager.execute(walletAddress, deserialize(quote))
    }
  }

  @LogOperation('rebalance_storage', LiquidityManagerLogger)
  async storeRebalancing(@LogContext walletAddress: string, @LogContext request: RebalanceRequest) {
    const groupID = EcoDbEntity.REBALANCE_JOB_GROUP.getEntityID()

    for (const quote of request.quotes) {
      // Skip invalid quotes which could lead to bogus DB entries
      if (quote.amountIn <= 0n || quote.amountOut <= 0n) {
        this.logger.warn(
          {
            rebalanceId: quote.rebalanceJobID || 'pending',
            walletAddress,
            strategy: quote.strategy,
            sourceChainId: quote.tokenIn.chainId,
            destinationChainId: quote.tokenOut.chainId,
          },
          'Skipping storing invalid rebalance quote',
          {
            token_in: quote.tokenIn.config,
            token_out: quote.tokenOut.config,
            amount_in: quote.amountIn.toString(),
            amount_out: quote.amountOut.toString(),
          },
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
    }
  }

  /**
   * Checks if a rebalancing is possible between the deficit and surplus tokens.
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  @LogSubOperation('rebalancing_quotes')
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
            {
              rebalanceId: 'system',
              walletAddress,
              strategy: 'quote_generation',
            },
            'Skipping quote for zero/negative swapAmount',
            {
              surplus_token: surplusToken.config,
              deficit_token: deficitToken.config,
              swap_amount: swapAmount,
            },
          )
          continue
        }

        // Skip dust trades below global threshold (base-6 tokens)
        if (minTradeTokens > 0 && swapAmount < minTradeTokens) {
          this.logger.debug(
            {
              rebalanceId: 'quote_generation',
              walletAddress,
              strategy: 'threshold_check',
            },
            'Skipping quote below global minTradeBase6 threshold',
            {
              swapAmount,
              minTradeBase6,
              surplusToken: surplusToken.config,
              deficitToken: deficitToken.config,
            },
          )
          continue
        }

        const strategyQuotes = await this.liquidityProviderManager.getQuote(
          walletAddress,
          surplusToken,
          deficitToken,
          swapAmount,
        )

        // Quote generation logged by decorator - context includes strategy details

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
          {
            rebalanceId: 'quote_generation',
            walletAddress,
            strategy: 'direct_route',
          },
          'Direct route failed',
          {
            surplusToken: surplusToken.config,
            deficitToken: deficitToken.config,
            error: (error as Error).message,
          },
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
        {
          rebalanceId: 'quote_validation',
          walletAddress: 'unknown',
          strategy: 'validation',
        },
        'Skipping quote for invalid quote tokenOut config',
        {
          quote,
          deficitToken,
        },
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
