import { Hex } from 'viem';
import { UtilsIntentService } from './utils-intent.service';
import { Solver } from '@libs/solver-config';
import { EcoConfigService } from '@libs/solver-config';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { WalletFulfillService } from '@eco-solver/intent/wallet-fulfill.service';
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
export declare class FulfillIntentService {
    private readonly utilsIntentService;
    private readonly ecoConfigService;
    private readonly walletFulfillService;
    private readonly crowdLiquidityService;
    private readonly ecoAnalytics;
    private logger;
    constructor(utilsIntentService: UtilsIntentService, ecoConfigService: EcoConfigService, walletFulfillService: WalletFulfillService, crowdLiquidityService: CrowdLiquidityService, ecoAnalytics: EcoAnalyticsService);
    /**
     * Processes and fulfills a specified intent based on its type.
     *
     * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
     * @return {Promise<void>} Returns the result of the fulfillment process based on the intent type.
     */
    fulfill(intentHash: Hex): Promise<unknown>;
    /**
     * Executes the fulfillment of an intent using crowd liquidity.
     *
     * @param {IntentSourceModel} model - The model representing the intent to be fulfilled.
     * @param {Solver} solver - The solver responsible for executing the fulfillment of the intent.
     * @return {Promise<void>} A promise that resolves when the intent fulfillment is successfully executed.
     */
    executeFulfillIntentWithCL(model: IntentSourceModel, solver: Solver): Promise<Hex>;
}
