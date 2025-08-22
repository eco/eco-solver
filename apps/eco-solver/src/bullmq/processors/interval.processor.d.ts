import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RetryInfeasableIntentsService } from '@eco-solver/intervals/retry-infeasable-intents.service';
export declare class IntervalProcessor extends WorkerHost {
    private readonly retryInfeasableIntentsService;
    private logger;
    constructor(retryInfeasableIntentsService: RetryInfeasableIntentsService);
    process(job: Job<any, any, string>, processToken?: string | undefined): Promise<any>;
    onJobFailed(job: Job<any, any, string>, error: Error): void;
}
