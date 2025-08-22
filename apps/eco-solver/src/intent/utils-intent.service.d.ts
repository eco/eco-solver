import { IntentSourceModel } from './schemas/intent-source.schema';
import { Model } from 'mongoose';
import { EcoConfigService } from '@libs/solver-config';
import { Solver, TargetContract } from '@libs/solver-config';
import { EcoError } from '../common/errors/eco-error';
import { DecodeFunctionDataReturnType } from 'viem';
import { Hex } from 'viem';
import { FulfillmentLog } from '@eco-solver/contracts/inbox';
import { Network } from '@eco-solver/common/alchemy/network';
import { ValidationChecks } from '@eco-solver/intent/validation.sevice';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * Data for a transaction target
 */
export interface TransactionTargetData {
    decodedFunctionData: DecodeFunctionDataReturnType;
    selector: Hex;
    targetConfig: TargetContract;
}
/**
 * Type for logging in validations
 */
export interface IntentLogType {
    hash?: Hex;
    sourceNetwork?: Network;
}
/**
 * Model and solver for the intent
 */
export interface IntentProcessData {
    model: IntentSourceModel | null;
    solver: Solver | null;
    err?: EcoError;
}
/**
 * Service class for solving an intent on chain
 */
export declare class UtilsIntentService {
    private intentModel;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    constructor(intentModel: Model<IntentSourceModel>, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    /**
     * updateOne the intent model in the database, using the intent hash as the query
     *
     * @param intentModel the model factory to use
     * @param model the new model data
     */
    updateIntentModel(model: IntentSourceModel): Promise<import("mongoose").UpdateWriteOpResult>;
    /**
     * Updates the intent model with the invalid cause, using {@link updateIntentModel}
     *
     * @param intentModel the model factory to use
     * @param model the new model data
     * @param invalidCause the reason the intent is invalid
     * @returns
     */
    updateInvalidIntentModel(model: IntentSourceModel, invalidCause: ValidationChecks): Promise<import("mongoose").UpdateWriteOpResult>;
    /**
     * Updates the intent model with the infeasable cause and receipt, using {@link updateIntentModel}
     *
     * @param intentModel  the model factory to use
     * @param model  the new model data
     * @param infeasable  the infeasable result
     * @returns
     */
    updateInfeasableIntentModel(model: IntentSourceModel, infeasable: Error): Promise<import("mongoose").UpdateWriteOpResult>;
    /**
     * Updates the intent model with the fulfillment status. If the intent was fulfilled by this solver, then
     * the status should already be SOLVED: in that case this function does nothing.
     *
     * @param fulfillment the fulfillment log event
     */
    updateOnFulfillment(fulfillment: FulfillmentLog): Promise<void>;
    /**
     * Finds the the intent model in the database by the intent hash and the solver that can fulfill
     * on the destination chain for that intent
     *
     * @param intentHash the intent hash
     * @returns Intent model and solver
     */
    getIntentProcessData(intentHash: string): Promise<IntentProcessData | undefined>;
    getSolver(destination: bigint, opts?: any): Promise<Solver | undefined>;
}
