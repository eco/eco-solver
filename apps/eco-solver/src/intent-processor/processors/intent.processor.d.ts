import { OnApplicationBootstrap } from '@nestjs/common';
import { IntentProcessorJob } from '@eco-solver/intent-processor/jobs/intent-processor.job';
import { IntentProcessorService } from '@eco-solver/intent-processor/services/intent-processor.service';
import { IntentProcessorQueueType } from '@eco-solver/intent-processor/queues/intent-processor.queue';
import { GroupedJobsProcessor } from '@eco-solver/common/bullmq/grouped-jobs.processor';
/**
 * Processor for handling liquidity manager jobs.
 * Extends the GroupedJobsProcessor to ensure jobs in the same group are not processed concurrently.
 */
export declare class IntentProcessor extends GroupedJobsProcessor<IntentProcessorJob> implements OnApplicationBootstrap {
    readonly queue: IntentProcessorQueueType;
    readonly intentProcessorService: IntentProcessorService;
    protected appReady: boolean;
    private readonly nonConcurrentJobs;
    constructor(queue: IntentProcessorQueueType, intentProcessorService: IntentProcessorService);
    process(job: IntentProcessorJob): Promise<any>;
    onApplicationBootstrap(): void;
    protected avoidConcurrency(job: IntentProcessorJob): Promise<boolean>;
    protected isAppReady(): boolean;
}
