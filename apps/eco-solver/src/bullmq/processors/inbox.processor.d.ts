import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { UtilsIntentService } from '@eco-solver/intent/utils-intent.service';
export declare class InboxProcessor extends WorkerHost {
    private readonly utilsIntentService;
    private logger;
    constructor(utilsIntentService: UtilsIntentService);
    process(job: Job<any, any, string>, processToken?: string | undefined): Promise<any>;
    onJobFailed(job: Job<any, any, string>, error: Error): void;
}
