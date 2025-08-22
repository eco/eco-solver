import { IntentFulfillmentQueueType } from '@eco-solver/intent-fulfillment/queues/intent-fulfillment.queue';
import { GroupedJobsProcessor } from '@eco-solver/common/bullmq/grouped-jobs.processor';
import { FulfillIntentJob } from '@eco-solver/intent-fulfillment/jobs/fulfill-intent.job';
import { FulfillIntentService } from '@eco-solver/intent/fulfill-intent.service';
export declare class IntentFulfillmentProcessor extends GroupedJobsProcessor<FulfillIntentJob> {
    readonly queue: IntentFulfillmentQueueType;
    readonly fulfillIntentService: FulfillIntentService;
    constructor(queue: IntentFulfillmentQueueType, fulfillIntentService: FulfillIntentService);
}
