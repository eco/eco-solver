import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq'
import { FlowProducer } from 'bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy } from 'lodash'
import { v4 as uuid } from 'uuid'
import * as _ from 'lodash'
import { formatUnits, Hex } from 'viem'
import { BalanceService } from '@/balance/balance.service'
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
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenConfig } from '@/balance/types'
import { removeJobSchedulers } from '@/bullmq/utils/queue'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { WrappedTokenService } from '@/liquidity-manager/services/wrapped-token.service'

@Injectable()
export class LiquidityManagerService implements OnApplicationBootstrap {
  private logger = new Logger(LiquidityManagerService.name)

  private config: LiquidityManagerConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue

  private readonly tokensPerWallet: Record<string, TokenConfig[]> = {}

  constructor(
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
    @InjectFlowProducer(LiquidityManagerQueue.flowName)
    protected liquidityManagerFlowProducer: FlowProducer,
    @InjectModel(RebalanceModel.name)
    private readonly rebalanceModel: Model<RebalanceModel>,
    public readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
    public readonly liquidityProviderManager: LiquidityProviderService,
    public readonly kernelAccountClientService: KernelAccountClientService,
    public readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly wrappedTokenService: WrappedTokenService,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  async onApplicationBootstrap() {
    // Remove existing job schedulers for CHECK_BALANCES
    await removeJobSchedulers(this.queue, LiquidityManagerJobName.CHECK_BALANCES)

    // Get wallet addresses we'll be monitoring
    this.config = this.ecoConfigService.getLiquidityManager()

    // Use OP as the default chain assuming the Kernel wallet is the same across all chains
    const opChainId = 10
    const client = await this.kernelAccountClientService.getClient(opChainId)
    const kernelAddress = client.kernelAccount.address

    // Track rebalances for Solver
    await this.liquidityManagerQueue.startCronJobs(this.config.intervalDuration, kernelAddress)
    this.tokensPerWallet[kernelAddress] = this.balanceService.getInboxTokens()

    if (this.ecoConfigService.getFulfill().type === 'crowd-liquidity') {
      // Track rebalances for Crowd Liquidity
      const crowdLiquidityPoolAddress = this.crowdLiquidityService.getPoolAddress()
      await this.liquidityManagerQueue.startCronJobs(
        this.config.intervalDuration,
        crowdLiquidityPoolAddress,
      )
      this.tokensPerWallet[crowdLiquidityPoolAddress] =
        this.crowdLiquidityService.getSupportedTokens()
    }
  }

  async analyzeTokens(walletAddress: string) {
    const tokens: TokenData[] = await this.balanceService.getAllTokenDataForAddress(
      walletAddress,
      this.tokensPerWallet[walletAddress],
    )
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
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   */
  async getOptimizedRebalancing(
    walletAddress: string,
    deficitToken: TokenDataAnalyzed,
    surplusTokens: TokenDataAnalyzed[],
  ) {
    const swapQuotes = await this.getSwapQuotes(walletAddress, deficitToken, surplusTokens)

    // Continue with swap quotes if possible
    if (swapQuotes.length) return swapQuotes

    return this.getRebalancingQuotes(walletAddress, deficitToken, surplusTokens)
  }

  startRebalancing(walletAddress: string, rebalances: RebalanceRequest[]) {
    if (!rebalances.length) return

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
    for (const quote of rebalance.quotes) {
      await this.liquidityProviderManager.execute(walletAddress, deserialize(quote))
    }
  }

  async storeRebalancing(walletAddress: string, request: RebalanceRequest) {
    const groupId = uuid()
    for (const quote of request.quotes) {
      await this.rebalanceModel.create({
        groupId,
        wallet: walletAddress,
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
   * @param walletAddress
   * @param deficitToken
   * @param surplusTokens
   * @private
   */
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
      try {
        // Calculate the amount to swap
        const swapAmount = Math.min(deficitToken.analysis.diff, surplusToken.analysis.diff)

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
          currentBalance += quote.amountOut
        }

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
                stack: error.stack,
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

  /**
   * Gets all WETH rebalance requests for the given wallet address
   * This method delegates to the WrappedTokenService for handling wrapped token operations
   * @param walletAddress The wallet address to check for WETH rebalances
   * @returns Array of rebalance requests
   */
  async getWETHRebalances(walletAddress: string): Promise<RebalanceRequest[]> {
    try {
      // Delegate to the specialized WrappedTokenService
      return await this.wrappedTokenService.getWrappedTokenRebalances(walletAddress as Hex)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error getting WETH rebalances',
          properties: {
            walletAddress,
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
          },
        }),
      )
      return []
    }
  }
}
