import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FeasableIntentService } from '@eco-solver/intent/feasable-intent.service';
import { ValidateIntentService } from '@eco-solver/intent/validate-intent.service';
import { CreateIntentService } from '@eco-solver/intent/create-intent.service';
import { FulfillIntentService } from '@eco-solver/intent/fulfill-intent.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
export declare class SolveIntentProcessor extends WorkerHost {
    private readonly createIntentService;
    private readonly validateIntentService;
    private readonly feasableIntentService;
    private readonly fulfillIntentService;
    private readonly ecoAnalytics;
    private logger;
    constructor(createIntentService: CreateIntentService, validateIntentService: ValidateIntentService, feasableIntentService: FeasableIntentService, fulfillIntentService: FulfillIntentService, ecoAnalytics: EcoAnalyticsService);
    process(job: Job<any, any, string>, processToken?: string | undefined): Promise<any>;
    onJobFailed(job: Job<any, any, string>, error: Error): void;
}
