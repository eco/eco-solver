import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
import { Queue } from 'bullmq';
type CheckBalancesCronJob = LiquidityManagerJob<LiquidityManagerJobName.CHECK_BALANCES, {
    wallet: string;
}>;
/**
 * A cron job that checks token balances, logs information, and attempts to rebalance deficits.
 */
export declare class CheckBalancesCronJobManager extends LiquidityManagerJobManager {
    static readonly jobSchedulerNamePrefix = "job-scheduler-check-balances";
    private static ecoCronJobManagers;
    /**
     * Gets the unique job scheduler name for a specific wallet
     * @param walletAddress - Wallet address for the job
     * @returns The unique job scheduler name
     */
    static getJobSchedulerName(walletAddress: string): string;
    /**
     * Starts the CheckBalancesCronJob by removing existing repeatable jobs and adding a new one to the queue.
     * @param queue - The job queue to add the job to.
     * @param interval - Interval duration in which the job is repeated
     * @param walletAddress - Wallet address
     */
    static start(queue: Queue, interval: number, walletAddress: string): Promise<void>;
    static stop(walletAddress: string): void;
    /**
     * Type guard to check if the given job is an instance of CheckBalancesCronJob.
     * @param job - The job to check.
     * @returns True if the job is a CheckBalancesCronJob.
     */
    is(job: LiquidityManagerJob): job is CheckBalancesCronJob;
    /**
     * Processes the CheckBalancesCronJob by analyzing token balances, logging the results, and rebalancing deficits.
     * @param job - The CheckBalancesCronJob instance to process.
     * @param processor - The LiquidityManagerProcessor instance used for processing.
     */
    process(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: LiquidityManagerJob, processor: LiquidityManagerProcessor, error: unknown): void;
    /**
     * Displays a table of token data analysis.
     * @param items - The token data to display.
     * @returns A formatted table as a string.
     */
    private displayTokenTable;
    /**
     * Displays a table of the rebasing data.
     * @param items - The token data to display.
     * @returns A formatted table as a string.
     */
    private displayRebalancingTable;
    /**
     * Updates the group balances after rebalancing quotes are received.
     * @param processor - The LiquidityManagerProcessor instance used for processing.
     * @param items - The list of token data analyzed.
     * @param rebalancingQuotes - The quotes received for rebalancing.
     */
    private updateGroupBalances;
}
export {};
