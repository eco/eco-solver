import { OnModuleInit } from '@nestjs/common';
import { Hex } from 'viem';
import { Queue } from 'bullmq';
import { Solver } from '@libs/solver-config';
import { EcoConfigService } from '@libs/solver-config';
import { UtilsIntentService } from './utils-intent.service';
import { IntentSourceModel } from './schemas/intent-source.schema';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
import { ValidationChecks, ValidationService } from '@eco-solver/intent/validation.sevice';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * Type that merges the {@link ValidationChecks} with the intentFunded check
 */
export type IntentValidations = ValidationChecks & {
    intentFunded: boolean;
};
/**
 * Service class that acts as the main validation service for intents.
 * Validation {@license ValidationService}:
 * supportedProver: boolean
 * supportedNative: boolean
 * supportedTargets: boolean
 * supportedTransaction: boolean
 * validTransferLimit: boolean
 * validExpirationTime: boolean
 * validDestination: boolean
 * fulfillOnDifferentChain: boolean
 * sufficientBalance: boolean
 *
 * Validates that the intent was also funded:
 * 1. The intent was funded on chain in the IntentSource
 *
 * As well as some structural checks on the intent model
 */
export declare class ValidateIntentService implements OnModuleInit {
    private readonly intentQueue;
    private readonly validationService;
    private readonly multichainPublicClientService;
    private readonly utilsIntentService;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    private intentJobConfig;
    private MAX_RETRIES;
    private RETRY_DELAY_MS;
    constructor(intentQueue: Queue, validationService: ValidationService, multichainPublicClientService: MultichainPublicClientService, utilsIntentService: UtilsIntentService, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): void;
    /**
     * @param intentHash the hash of the intent to fulfill
     */
    validateIntent(intentHash: Hex): Promise<boolean>;
    /**
     * Executes all the validations we have on the model and solver
     *
     * @param model the source intent model
     * @param solver the solver for the source chain
     * @returns true if they all pass, false otherwise
     */
    assertValidations(model: IntentSourceModel, solver: Solver): Promise<boolean>;
    /**
     * Makes on onchain read call to make sure that the intent was funded in the IntentSource
     * contract.
     * @Notice An event emitted is not enough to guarantee that the intent was funded
     * @param model the source intent model
     * @returns
     */
    intentFunded(model: IntentSourceModel): Promise<boolean>;
    /**
     * Fetches the intent from the db and its solver and model from configs. Validates
     * that both are returned without any error
     *
     * @param intentHash the hash of the intent to find in the db
     * @returns
     */
    private destructureIntent;
}
