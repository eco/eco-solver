import { EcoConfigService } from '@libs/solver-config';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { ProofService } from '@eco-solver/prover/proof.service';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
export declare class RetryInfeasableIntentsService implements OnApplicationBootstrap {
    private readonly intervalQueue;
    private readonly intentQueue;
    private intentModel;
    private readonly proofService;
    private readonly ecoConfigService;
    private logger;
    private intentJobConfig;
    constructor(intervalQueue: Queue, intentQueue: Queue, intentModel: Model<IntentSourceModel>, proofService: ProofService, ecoConfigService: EcoConfigService);
    onModuleInit(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
    /**
     * Retries intents that are infeasable but still within the proof expiration window.
     * Sends them on the {@link QUEUES.SOURCE_INTENT.jobs.retry_intent} queue to validate
     */
    retryInfeasableIntents(): Promise<void>;
    private getInfeasableIntents;
}
