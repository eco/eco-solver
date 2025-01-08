import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
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
import { RebalanceJobManager, RebalanceJobData } from '@/liquidity-manager/jobs/rebalanceJobManager'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { deserialize } from '@/liquidity-manager/utils/serialize'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private config: LiquidityManagerConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    queue: LiquidityManagerQueueType,
    @InjectFlowProducer(LiquidityManagerQueue.flowName)
    protected liquidityManagerFlowProducer: FlowProducer,
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
    const tokens: LiquidityManager.TokenData[] = await this.balanceService.getAllTokenData()
    const analysis: LiquidityManager.TokenDataAnalyzed[] = tokens.map((item) => ({
      ...item,
      analysis: this.analyzeToken(item),
    }))

    const groups = groupBy(analysis, (item) => item.analysis.state)
    return {
      items: analysis,
      surplus: analyzeTokenGroup(groups[TokenState.SURPLUS] ?? []),
      deficit: analyzeTokenGroup(groups[TokenState.DEFICIT] ?? []),
    }
  }

  analyzeToken(token: LiquidityManager.TokenData) {
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
    deficitToken: LiquidityManager.TokenDataAnalyzed,
    surplusTokens: LiquidityManager.TokenDataAnalyzed[],
  ) {
    const swapQuotes = await this.getSwapQuotes(deficitToken, surplusTokens)

    // Continue with swap quotes if possible
    if (swapQuotes.length) return swapQuotes

    return this.getRebalancingQuotes(deficitToken, surplusTokens)
  }

  startRebalancing(rebalances: LiquidityManager.RebalanceRequest[]) {
    const jobs = rebalances.map((rebalance) =>
      RebalanceJobManager.createJob(rebalance, this.liquidityManagerQueue.name),
    )
    return this.liquidityManagerFlowProducer.add({
      name: 'rebalance-batch',
      queueName: this.liquidityManagerQueue.name,
      children: jobs,
    })
  }

  /**
   * Checks if a swap is possible between the deficit and surplus tokens.
   * @dev swaps are possible if the deficit is compensated by the surplus of tokens in the same chain.
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
  private async getSwapQuotes(
    deficitToken: LiquidityManager.TokenDataAnalyzed,
    surplusTokens: LiquidityManager.TokenDataAnalyzed[],
  ) {
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
    deficitToken: LiquidityManager.TokenDataAnalyzed,
    surplusTokens: LiquidityManager.TokenDataAnalyzed[],
  ) {
    const sortedSurplusTokens = getSortGroupByDiff(surplusTokens)
    const surplusTokensTotal = getGroupTotal(sortedSurplusTokens)

    if (deficitToken.analysis.diff > surplusTokensTotal) {
      // Not enough surplus tokens to rebalance
      return []
    }

    const quotes: LiquidityManager.Quote[] = []
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

  async executeRebalancing(rebalanceData: RebalanceJobData) {
    for (const quote of rebalanceData.rebalance.quotes) {
      await this.liquidityProviderManager.execute(deserialize(quote))
    }
  }
}
