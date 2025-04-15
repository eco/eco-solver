import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
import { v4 as uuid } from 'uuid'
import { BalanceService } from '@/balance/balance.service'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import {
  analyzeToken,
  analyzeTokenGroup,
  getGroupTotal,
  getSortGroupByDiff,
} from '@/liquidity-manager/utils/token'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { RebalanceJobData, RebalanceJobManager } from '@/liquidity-manager/jobs/rebalance.job'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { deserialize } from '@/common/utils/serialize'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import {
  RebalanceQuote,
  RebalanceRequest,
  TokenData,
  TokenDataAnalyzed,
} from '@/liquidity-manager/types/types'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private logger = new Logger(LiquidityManagerService.name)

  private config: LiquidityManagerConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    queue: LiquidityManagerQueueType,
    @InjectFlowProducer(LiquidityManagerQueue.flowName)
    protected liquidityManagerFlowProducer: FlowProducer,
    @InjectModel(RebalanceModel.name)
    private readonly rebalanceModel: Model<RebalanceModel>,
    public readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
    public readonly liquidityProviderManager: LiquidityProviderService,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  onApplicationBootstrap() {
    this.config = this.ecoConfigService.getLiquidityManager()
    return this.liquidityManagerQueue.startCronJobs(this.config.intervalDuration)
  }

  async analyzeTokens() {
    const tokens: TokenData[] = await this.balanceService.getAllTokenData()
    const analysis: TokenDataAnalyzed[] = tokens.map((item) => ({
      ...item,
      analysis: this.analyzeToken(item),
    }))

    const groups = groupBy(analysis, (item) => item.analysis.state)
    return {
      items: analysis,
      surplus: analyzeTokenGroup(groups[TokenState.SURPLUS] ?? []),
      inrange: analyzeTokenGroup(groups[TokenState.IN_RANGE] ?? []),
      deficit: analyzeTokenGroup(groups[TokenState.DEFICIT] ?? []),
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
   * @param deficitToken
   * @param surplusTokens
   */
  async getOptimizedRebalancing(
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
  ) {
    const swapQuotes = await this.getSwapQuotes(deficitToken, surplusTokens)

    // Continue with swap quotes if possible
    if (swapQuotes.length) return swapQuotes

    return this.getRebalancingQuotes(deficitToken, surplusTokens)
  }

  startRebalancing(rebalances: RebalanceRequest[]) {
    const jobs = rebalances.map((rebalance) =>
      RebalanceJobManager.createJob(rebalance, this.liquidityManagerQueue.name),
    )
    return this.liquidityManagerFlowProducer.add({
      name: 'rebalance-batch',
      queueName: this.liquidityManagerQueue.name,
      children: jobs,
    })
  }

  async executeRebalancing(rebalanceData: RebalanceJobData) {
    for (const quote of rebalanceData.rebalance.quotes) {
      await this.liquidityProviderManager.execute(deserialize(quote))
    }
  }

  async storeRebalancing(request: RebalanceRequest) {
    const groupId = uuid()
    for (const quote of request.quotes) {
      await this.rebalanceModel.create({
        groupId,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        slippage: quote.slippage,
        strategy: quote.strategy,
        context: quote.context,
        tokenIn: RebalanceTokenModel.fromTokenData(quote.tokenIn),
        tokenOut: RebalanceTokenModel.fromTokenData(quote.tokenOut),
      })
    }
  }

  /**
   * Checks if a swap is possible between the deficit and surplus tokens.
   * @dev swaps are possible if the deficit is compensated by the surplus of tokens in the same chain.
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  private async getSwapQuotes(deficitToken: TokenDataAnalyzed, surplusTokens: TokenDataAnalyzed[]) {
    const surplusTokensSameChain = surplusTokens.filter(
      (token) => token.config.chainId === deficitToken.config.chainId,
    )

    return this.getRebalancingQuotes(deficitToken, surplusTokensSameChain)
  }

  /**
   * Checks if a rebalancing is possible between the deficit and surplus tokens.
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  private async getRebalancingQuotes(
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
  ) {
    const sortedSurplusTokens = getSortGroupByDiff(surplusTokens)
    const surplusTokensTotal = getGroupTotal(sortedSurplusTokens)

    if (deficitToken.analysis.diff > surplusTokensTotal) {
      // Not enough surplus tokens to rebalance
      return []
    }

    const quotes: RebalanceQuote[] = []
    const failedSurplusTokens: TokenDataAnalyzed[] = []
    let currentBalance = deficitToken.analysis.balance.current

    // First try all direct routes from surplus tokens to deficit token
    for (const surplusToken of sortedSurplusTokens) {
      try {
        // Calculate the amount to swap
        const swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

        // Try with direct route
        const quote = await this.liquidityProviderManager.getQuote(
          surplusToken,
          deficitToken,
          swapAmount,
        )

        quotes.push(quote)
        currentBalance += quote.amountOut

        if (currentBalance >= deficitToken.analysis.targetSlippage.min) break
      } catch (error) {
        // Track failed surplus tokens
        failedSurplusTokens.push(surplusToken)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'Direct route not found, will try with fallback',
            properties: {
              surplusToken: surplusToken.config,
              deficitToken: deficitToken.config,
              error: {
                message: error.message,
              },
            },
          }),
        )
      }
    }

    // If we've reached the target balance or have no more tokens to try, return what we've got
    if (currentBalance >= deficitToken.analysis.targetSlippage.min || !failedSurplusTokens.length) {
      return quotes
    }

    // Try the failed surplus tokens with the fallback (core token) strategies
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'Still below target balance, trying fallback routes with core tokens',
        properties: {
          currentBalance: currentBalance.toString(),
          targetMin: deficitToken.analysis.targetSlippage.min.toString(),
          failedTokensCount: failedSurplusTokens.length,
        },
      }),
    )

    // Try each failed token with the fallback method
    for (const surplusToken of failedSurplusTokens) {
      // Skip if we've already reached target balance
      if (currentBalance >= deficitToken.analysis.targetSlippage.min) break

      try {
        // Calculate the amount to swap
        const swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

        // Use the fallback method that routes through core tokens
        const quote = await this.liquidityProviderManager.fallback(
          surplusToken,
          deficitToken,
          swapAmount,
        )

        quotes.push(quote)
        currentBalance += quote.amountOut
      } catch (fallbackError) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: 'Unable to find fallback route',
            properties: {
              surplusToken: surplusToken.config,
              deficitToken: deficitToken.config,
              error: {
                message: fallbackError.message,
                stack: fallbackError.stack,
              },
            },
          }),
        )
      }
    }

    return quotes
  }
}
