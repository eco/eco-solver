import { EcoCronJobManager } from '@/liquidity-manager/jobs/eco-cron-job-manager'
import { formatUnits } from 'viem'
import {
  LiquidityManagerJob,
  LiquidityManagerJobManager,
} from '@/liquidity-manager/jobs/liquidity-manager.job'
import {
  LiquidityManagerJobName,
  LiquidityManagerQueueDataType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { CheckBalancesProcessor } from '@/liquidity-manager/processors/check-balances.processor'
import { Queue } from 'bullmq'
import { shortAddr } from '@/liquidity-manager/utils/address'
import { table } from 'table'
import {
  RebalanceQuote,
  RebalanceRequest,
  TokenDataAnalyzed,
} from '@/liquidity-manager/types/types'
import { TokenState } from '@/liquidity-manager/types/token-state.enum'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'

export interface CheckBalancesCronJobData extends LiquidityManagerQueueDataType {
  wallet: string
}

export type CheckBalancesCronJob = LiquidityManagerJob<
  LiquidityManagerJobName.CHECK_BALANCES,
  CheckBalancesCronJobData
>

/**
 * A cron job that checks token balances, logs information, and attempts to rebalance deficits.
 */
export class CheckBalancesCronJobManager extends LiquidityManagerJobManager<CheckBalancesCronJob> {
  static readonly jobSchedulerNamePrefix = 'job-scheduler-check-balances'
  private static ecoCronJobManagers: Record<string, EcoCronJobManager> = {}

  /**
   * Gets the unique job scheduler name for a specific wallet
   * @param walletAddress - Wallet address for the job
   * @returns The unique job scheduler name
   */
  static getJobSchedulerName(walletAddress: string): string {
    return `${this.jobSchedulerNamePrefix}-${walletAddress}`
  }

  /**
   * Starts the CheckBalancesCronJob by removing existing repeatable jobs and adding a new one to the queue.
   * @param queue - The job queue to add the job to.
   * @param interval - Interval duration in which the job is repeated
   * @param walletAddress - Wallet address
   */
  static async start(queue: Queue, interval: number, walletAddress: string): Promise<void> {
    if (!this.ecoCronJobManagers[walletAddress]) {
      this.ecoCronJobManagers[walletAddress] = new EcoCronJobManager(
        LiquidityManagerJobName.CHECK_BALANCES,
        `check-balances-${walletAddress}`,
      )
    }

    await this.ecoCronJobManagers[walletAddress].start(queue, interval, walletAddress)
  }

  static stop(walletAddress: string) {
    this.ecoCronJobManagers[walletAddress]?.stop()
    delete this.ecoCronJobManagers[walletAddress]
  }

  /**
   * Type guard to check if the given job is an instance of CheckBalancesCronJob.
   * @param job - The job to check.
   * @returns True if the job is a CheckBalancesCronJob.
   */
  is(job: LiquidityManagerJob): job is CheckBalancesCronJob {
    return job.name === LiquidityManagerJobName.CHECK_BALANCES
  }

  /**
   * Processes the CheckBalancesCronJob by analyzing token balances, logging the results, and rebalancing deficits.
   * @param job - The CheckBalancesCronJob instance to process.
   * @param processor - The LiquidityManagerProcessor instance used for processing.
   */
  @LogOperation('job_execution', GenericOperationLogger)
  async process(
    @LogContext job: LiquidityManagerJob,
    processor: LiquidityManagerProcessor,
  ): Promise<void> {
    // Cast to CheckBalancesProcessor to access healthLogger
    const checkBalancesProcessor = processor as any as CheckBalancesProcessor
    if (!this.is(job)) {
      checkBalancesProcessor.healthLogger.warn(
        {
          healthCheck: 'balance-monitoring',
          status: 'warning',
        },
        'CheckBalancesCronJobManager: It is not a CheckBalancesCron job',
      )
      return
    }

    const { wallet: walletAddress } = job.data

    const { deficit, surplus, items } =
      await processor.liquidityManagerService.analyzeTokens(walletAddress)

    checkBalancesProcessor.healthLogger.log(
      {
        healthCheck: 'balance-monitoring',
        status: 'healthy',
      },
      'CheckBalancesCronJob: process',
      {
        walletAddress,
        surplus: surplus.total,
        deficit: deficit.total,
      },
    )

    checkBalancesProcessor.healthLogger.log(
      {
        healthCheck: 'balance-monitoring',
        status: 'healthy',
      },
      this.displayTokenTable(items),
    )

    if (!deficit.total) {
      checkBalancesProcessor.healthLogger.log(
        {
          healthCheck: 'balance-monitoring',
          status: 'healthy',
        },
        'CheckBalancesCronJob: No deficits found',
        { walletAddress },
      )
      return
    }

    const rebalances: RebalanceRequest[] = []

    for (const deficitToken of deficit.items) {
      // Filter dynamic surplus list to only usable entries (still SURPLUS with diff>0)
      const usableSurplus = surplus.items.filter(
        (t) => t?.analysis?.state === TokenState.SURPLUS && (t?.analysis?.diff ?? 0) > 0,
      )
      const rebalancingQuotes = await processor.liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        deficitToken,
        usableSurplus,
      )

      if (rebalancingQuotes.length === 0) {
        checkBalancesProcessor.healthLogger.debug(
          {
            healthCheck: 'balance-monitoring',
            status: 'degraded',
          },
          'CheckBalancesCronJob: No rebalancing quotes found',
          {
            deficitToken,
          },
        )
        continue
      }

      this.updateGroupBalances(processor, surplus.items, rebalancingQuotes)
      const rebalanceRequest = { token: deficitToken, quotes: rebalancingQuotes }

      // Store rebalance request on DB
      await processor.liquidityManagerService.storeRebalancing(walletAddress, rebalanceRequest)
      rebalances.push(rebalanceRequest)
    }

    if (!rebalances.length) {
      checkBalancesProcessor.healthLogger.warn(
        {
          healthCheck: 'balance-monitoring',
          status: 'unhealthy',
        },
        'CheckBalancesCronJob: No rebalancing routes available',
        { walletAddress },
      )
      return
    }

    checkBalancesProcessor.healthLogger.log(
      {
        healthCheck: 'balance-monitoring',
        status: 'healthy',
      },
      this.displayRebalancingTable(rebalances),
    )

    await processor.liquidityManagerService.startRebalancing(walletAddress, rebalances)
  }

  /**
   * Handles job failures by logging the error.
   * @param job - The job that failed.
   * @param processor - The processor handling the job.
   * @param error - The error that occurred.
   */
  @LogOperation('job_execution', GenericOperationLogger)
  onFailed(
    @LogContext job: LiquidityManagerJob,
    processor: LiquidityManagerProcessor,
    @LogContext error: unknown,
  ) {
    // Error details are automatically captured by the decorator
    const errorObj = error instanceof Error ? error : new Error(String(error))
    throw errorObj
  }

  /**
   * Hook triggered when a job is completed successfully.
   */
  @LogOperation('job_execution', GenericOperationLogger)
  onComplete(@LogContext job: LiquidityManagerJob, processor: LiquidityManagerProcessor) {
    const checkBalancesProcessor = processor as any as CheckBalancesProcessor
    const durationMs = this.getDurationMs(job)
    checkBalancesProcessor.healthLogger.log(
      {
        healthCheck: 'balance-monitoring',
        status: 'healthy',
        responseTime: durationMs,
      },
      'CheckBalancesCronJob: completed',
      {
        durationMs,
        walletAddress: job.data.wallet,
        queue: job.queueName,
      },
    )
  }

  private getDurationMs(job: LiquidityManagerJob) {
    const finishedOn = job.finishedOn ?? Date.now()
    const processedOn = job.processedOn ?? finishedOn
    return finishedOn - processedOn
  }

  /**
   * Displays a table of token data analysis.
   * @param items - The token data to display.
   * @returns A formatted table as a string.
   */
  private displayTokenTable(items: TokenDataAnalyzed[]) {
    const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format

    const header = ['Chain ID', 'Address', 'Balance', 'Target', 'Range', 'State']
    const cells = items.map((item) => {
      const format = (value: bigint) =>
        formatter(parseFloat(formatUnits(value, item.balance.decimals)))
      return [
        item.config.chainId,
        item.config.address,
        format(item.analysis.balance.current),
        format(item.analysis.balance.target),
        `${format(item.analysis.balance.minimum)} - ${format(item.analysis.balance.maximum)}`,
        item.analysis.state,
      ]
    })

    return table([header, ...cells])
  }

  /**
   * Displays a table of the rebasing data.
   * @param items - The token data to display.
   * @returns A formatted table as a string.
   */
  private displayRebalancingTable(items: RebalanceRequest[]) {
    // Skip if no rebalancing quotes are found.
    if (!items.length) return 'No rebalancing quotes available'

    const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format
    const slippageFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format
    const format = (value: bigint, decimals: number) =>
      formatter(parseFloat(formatUnits(value, decimals)))

    const header = [
      'Token Out',
      'Chain Out',
      'Token In',
      'Chain In',
      'Current Balance',
      'Target Balance',
      'Strategy',
      'Amount In',
      'Amount Out',
      'Slippage',
    ]
    const cells = items
      .flatMap((item) => item.quotes)
      .map((quote) => {
        return [
          shortAddr(quote.tokenOut.config.address),
          quote.tokenOut.config.chainId,
          shortAddr(quote.tokenIn.config.address),
          quote.tokenIn.config.chainId,
          format(quote.tokenOut.balance.balance, quote.tokenOut.balance.decimals),
          quote.tokenOut.config.targetBalance,
          quote.strategy,
          format(quote.amountIn, quote.tokenIn.balance.decimals),
          format(quote.amountOut, quote.tokenOut.balance.decimals),
          slippageFormatter(quote.slippage * 100) + '%',
        ]
      })

    return table([header, ...cells], { columns: [{ width: 48 }] })
  }

  /**
   * Updates the group balances after rebalancing quotes are received.
   * @param processor - The LiquidityManagerProcessor instance used for processing.
   * @param items - The list of token data analyzed.
   * @param rebalancingQuotes - The quotes received for rebalancing.
   */
  private updateGroupBalances(
    processor: LiquidityManagerProcessor,
    items: TokenDataAnalyzed[],
    rebalancingQuotes: RebalanceQuote[],
  ) {
    for (const quote of rebalancingQuotes) {
      // Iterate through each rebalancing quote.
      const token = items.find(
        // Find the matching token in the items list.
        (item) =>
          item.config.address === quote.tokenIn.config.address &&
          item.config.chainId === quote.tokenIn.config.chainId,
      )
      if (!token) continue

      token.balance.balance -= quote.amountIn // Deduct the amount from the balance.
      token.analysis = processor.liquidityManagerService.analyzeToken(token) // Re-analyze the token balance.
    }
  }
}
