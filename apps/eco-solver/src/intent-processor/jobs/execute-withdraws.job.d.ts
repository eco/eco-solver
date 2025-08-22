import { BulkJobOptions, Job } from 'bullmq';
import { Hex } from 'viem';
import { Serialize } from '@eco-solver/common/utils/serialize';
import { IntentProcessorJobName } from '@eco-solver/intent-processor/queues/intent-processor.queue';
import { IntentProcessor } from '@eco-solver/intent-processor/processors/intent.processor';
import { IntentProcessorJob, IntentProcessorJobManager } from '@eco-solver/intent-processor/jobs/intent-processor.job';
import { IntentType } from '@eco-foundation/routes-ts';
export type ExecuteWithdrawsJobData = {
    chainId: number;
    intentSourceAddr: Hex;
    intents: IntentType[];
};
export type ExecuteWithdrawsJob = Job<Serialize<ExecuteWithdrawsJobData>, unknown, IntentProcessorJobName.EXECUTE_WITHDRAWS>;
export declare class ExecuteWithdrawsJobManager extends IntentProcessorJobManager<ExecuteWithdrawsJob> {
    static createJob(jobData: ExecuteWithdrawsJobData): {
        name: ExecuteWithdrawsJob['name'];
        data: ExecuteWithdrawsJob['data'];
        opts?: BulkJobOptions;
    };
    /**
     * Type guard to check if the given job is an instance of ExecuteWithdrawsJob.
     * @param job - The job to check.
     * @returns True if the job is a ExecuteWithdrawsJob.
     */
    is(job: IntentProcessorJob): job is ExecuteWithdrawsJob;
    process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: Error): void;
}
