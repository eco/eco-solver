import { JobsOptions, Job } from 'bullmq';
import { Hex } from 'viem';
import { BaseJobManager } from '@eco-solver/common/bullmq/base-job';
import { IntentFulfillmentJobName } from '@eco-solver/intent-fulfillment/queues/intent-fulfillment.queue';
import { Serialize } from '@eco-solver/common/utils/serialize';
import { IntentFulfillmentProcessor } from '@eco-solver/intent-fulfillment/processors/intent-fulfillment.processor';
export type FulfillIntentJobData = {
    intentHash: Hex;
    chainId: number;
};
export type FulfillIntentJob = Job<Serialize<FulfillIntentJobData>, unknown, IntentFulfillmentJobName.FULFILL_INTENT>;
export declare abstract class IntentFulfillmentJobManager extends BaseJobManager<FulfillIntentJob, IntentFulfillmentProcessor> {
}
export declare class FulfillIntentJobManager extends IntentFulfillmentJobManager {
    static createJob(jobData: FulfillIntentJobData): {
        name: FulfillIntentJob['name'];
        data: FulfillIntentJob['data'];
        opts?: JobsOptions;
    };
    is(job: FulfillIntentJob): job is FulfillIntentJob;
    process(job: FulfillIntentJob, processor: IntentFulfillmentProcessor): Promise<void>;
    onFailed(job: FulfillIntentJob, processor: IntentFulfillmentProcessor, error: Error): void;
}
