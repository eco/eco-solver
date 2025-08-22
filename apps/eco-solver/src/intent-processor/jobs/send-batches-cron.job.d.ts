import { Job, Queue } from 'bullmq';
import { IntentProcessorJobName } from '@eco-solver/intent-processor/queues/intent-processor.queue';
import { IntentProcessor } from '@eco-solver/intent-processor/processors/intent.processor';
import { IntentProcessorJob, IntentProcessorJobManager } from '@eco-solver/intent-processor/jobs/intent-processor.job';
export type CheckSendBatchJob = Job<undefined, undefined, IntentProcessorJobName.CHECK_SEND_BATCH>;
export declare class CheckSendBatchCronJobManager extends IntentProcessorJobManager {
    static readonly jobSchedulerName = "job-scheduler-send-batch";
    static start(queue: Queue, interval: number): Promise<void>;
    is(job: IntentProcessorJob): boolean;
    process(job: IntentProcessorJob, processor: IntentProcessor): Promise<void>;
    onFailed(job: IntentProcessorJob, processor: IntentProcessor, error: unknown): void;
}
