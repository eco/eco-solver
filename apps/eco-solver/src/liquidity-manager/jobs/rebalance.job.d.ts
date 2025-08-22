import { FlowChildJob, Job } from 'bullmq';
import { LiquidityManagerJob, LiquidityManagerJobManager } from '@eco-solver/liquidity-manager/jobs/liquidity-manager.job';
import { LiquidityManagerJobName } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor';
import { Serialize } from '@eco-solver/common/utils/serialize';
import { RebalanceRequest } from '@eco-solver/liquidity-manager/types/types';
export type RebalanceJobData = {
    network: string;
    walletAddress: string;
    rebalance: Serialize<RebalanceRequest>;
};
type RebalanceJob = Job<RebalanceJobData, unknown, LiquidityManagerJobName.REBALANCE>;
export declare class RebalanceJobManager extends LiquidityManagerJobManager<RebalanceJob> {
    static createJob(walletAddress: string, rebalance: RebalanceRequest, queueName: string): FlowChildJob;
    /**
     * Type guard to check if the given job is an instance of RebalanceJob.
     * @param job - The job to check.
     * @returns True if the job is a RebalanceJob.
     */
    is(job: LiquidityManagerJob): job is RebalanceJob;
    process(job: LiquidityManagerJob, processor: LiquidityManagerProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: LiquidityManagerJob, processor: LiquidityManagerProcessor, error: Error): void;
}
export {};
