import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import {
  analyzeToken,
  analyzeTokenGroup,
  getGroupTotal,
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
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenConfig } from '@/balance/types'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext, LogSubOperation } from '@/common/logging/decorators'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'
import { BalanceService } from '@/balance/balance.service'
import { EcoDbEntity } from '@/common/db/eco-db-entity.enum'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private logger = new LiquidityManagerLogger('LiquidityManagerService')

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
    public readonly kernelAccountClientService: KernelAccountClientService,
    public readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly rebalanceRepository: RebalanceRepository,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.checkBalancesQueueWrapper = new CheckBalancesQueue(this.checkBalancesQueue as any)
  }

  @LogOperation('system_bootstrap', LiquidityManagerLogger)
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

  @LogSubOperation('individual_token_analysis')
  analyzeToken(@LogContext token: TokenData) {
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
  @LogOperation('optimized_rebalancing', LiquidityManagerLogger)
  async getOptimizedRebalancing(
    @LogContext walletAddress: string,
    @LogContext deficitToken: TokenDataAnalyzed,
    @LogContext surplusTokens: TokenDataAnalyzed[],
  ) {
    const swapQuotes = await this.getSwapQuotes(walletAddress, deficitToken, surplusTokens)

    // Continue with swap quotes if possible
    if (swapQuotes.length > 0) {
      return swapQuotes
    }

    return this.getRebalancingQuotes(walletAddress, deficitToken, surplusTokens)
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
   * Checks if a swap is possible between the deficit and surplus tokens.
   * @dev swaps are possible if the deficit is compensated by the surplus of tokens in the same chain.
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  @LogSubOperation('swap_quotes')
  private async getSwapQuotes(
    walletAddress: string,
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
  ) {
    const surplusTokensSameChain = surplusTokens.filter(
      (token) => token.config.chainId === deficitToken.config.chainId,
    )

    return this.getRebalancingQuotes(walletAddress, deficitToken, surplusTokensSameChain)
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
  ) {
    if (!Array.isArray(surplusTokens) || surplusTokens.length === 0) {
      return []
    }

    const sortedSurplusTokens = getSortGroupByDiff(surplusTokens)
    const surplusTokensTotal = getGroupTotal(sortedSurplusTokens)

    if (!deficitToken?.analysis?.diff || deficitToken.analysis.diff > surplusTokensTotal) {
      // Not enough surplus tokens to rebalance
      return []
    }

    const quotes: RebalanceQuote[] = []
    const failedSurplusTokens: TokenDataAnalyzed[] = []
    let currentBalance = deficitToken.analysis.balance.current

    // First try all direct routes from surplus tokens to deficit token
    for (const surplusToken of sortedSurplusTokens) {
      let swapAmount = 0
      try {
        // Calculate the amount to swap
        swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

        const strategyQuotes = await this.liquidityProviderManager.getQuote(
          walletAddress,
          surplusToken,
          deficitToken,
          swapAmount,
        )

        // Quote generation logged by decorator - context includes strategy details

        for (const quote of strategyQuotes) {
          quotes.push(quote)
          currentBalance += quote.amountOut
        }

        if (currentBalance >= deficitToken.analysis.targetSlippage.min) break
      } catch (error) {
        // Log business event for quote strategy failure
        this.logger.logQuoteStrategyFailure(
          'direct_route',
          surplusToken,
          deficitToken,
          swapAmount,
          error as Error,
        )

        // Track failed surplus tokens
        failedSurplusTokens.push(surplusToken)

        this.ecoAnalytics.trackError(ANALYTICS_EVENTS.LIQUIDITY_MANAGER.QUOTE_ROUTE_ERROR, error, {
          surplusToken: surplusToken.config,
          deficitToken: deficitToken.config,
          swapAmount,
          walletAddress,
          operation: 'direct_route_quote',
          service: this.constructor.name,
        })
      }
    }

    // If we've reached the target balance or have no more tokens to try, return what we've got
    if (currentBalance >= deficitToken.analysis.targetSlippage.min || !failedSurplusTokens.length) {
      return quotes
    }

    // Try each failed token with the fallback method
    for (const surplusToken of failedSurplusTokens) {
      // Skip if we've already reached target balance
      if (currentBalance >= deficitToken.analysis.targetSlippage.min) break
      let swapAmount = 0
      try {
        // Calculate the amount to swap
        swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

        // Use the fallback method that routes through core tokens
        const fallbackQuotes = await this.liquidityProviderManager.fallback(
          surplusToken,
          deficitToken,
          swapAmount,
        )

        quotes.push(...fallbackQuotes)
        for (const quote of fallbackQuotes) {
          currentBalance += quote.amountOut
        }
      } catch (fallbackError) {
        this.ecoAnalytics.trackError(
          ANALYTICS_EVENTS.LIQUIDITY_MANAGER.FALLBACK_ROUTE_ERROR,
          fallbackError,
          {
            surplusToken: surplusToken.config,
            deficitToken: deficitToken.config,
            swapAmount,
            currentBalance,
            targetBalance: deficitToken.analysis.targetSlippage.min,
            operation: 'fallback_route_quote',
            service: this.constructor.name,
          },
        )
      }
    }

    return quotes
  }
}
