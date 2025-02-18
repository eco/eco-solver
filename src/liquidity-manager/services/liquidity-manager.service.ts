import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
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
import { deserialize } from '@/liquidity-manager/utils/serialize'
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

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
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
    let currentBalance = deficitToken.analysis.balance.current

    for (const surplusToken of sortedSurplusTokens) {
      // Calculate the amount to swap
      const swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

      const quote = await this.liquidityProviderManager.getQuote(
        surplusToken,
        deficitToken,
        swapAmount,
      )

      quotes.push(quote)
      currentBalance += quote.amountOut

      if (currentBalance >= deficitToken.analysis.targetSlippage.min) break
    }

    return quotes
  }
}
