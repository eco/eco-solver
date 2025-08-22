import { BulkJobOptions, Job } from 'bullmq';
import { Hex } from 'viem';
import { Serialize } from '@eco-solver/common/utils/serialize';
import { IntentProcessorJobName } from '@eco-solver/intent-processor/queues/intent-processor.queue';
import { IntentProcessor } from '@eco-solver/intent-processor/processors/intent.processor';
import { IntentProcessorJob, IntentProcessorJobManager } from '@eco-solver/intent-processor/jobs/intent-processor.job';
export interface ProveIntentData {
    hash: Hex;
    prover: Hex;
    source: number;
    intentSourceAddr: Hex;
    inbox: Hex;
}
export type ExecuteSendBatchJobData = {
    chainId: number;
    intentSourceAddr: Hex;
    inbox: Hex;
    proves: ProveIntentData[];
};
export type ExecuteSendBatchJob = Job<Serialize<ExecuteSendBatchJobData>, unknown, IntentProcessorJobName.EXECUTE_SEND_BATCH>;
export declare class ExecuteSendBatchJobManager extends IntentProcessorJobManager<ExecuteSendBatchJob> {
    static createJob(jobData: ExecuteSendBatchJobData): {
        name: ExecuteSendBatchJob['name'];
        data: ExecuteSendBatchJob['data'];
        opts?: BulkJobOptions;
    };
    /**
     * Type guard to check if the given job is an instance of ExecuteSendJob.
     * @param job - The job to check.
     * @returns True if the job is a ExecuteSendJob.
     */
    is(job: IntentProcessorJob): job is ExecuteSendBatchJob;
    process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void>;
    /**
     * Handles job failures by logging the error.
     * @param job - The job that failed.
     * @param processor - The processor handling the job.
     * @param error - The error that occurred.
     */
    onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: Error): void;
}
