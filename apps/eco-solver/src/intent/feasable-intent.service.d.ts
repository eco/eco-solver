import { UtilsIntentService } from './utils-intent.service';
import { Hex } from 'viem';
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema';
import { FeeService } from '@eco-solver/fee/fee.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
import { IntentFulfillmentQueue } from '@eco-solver/intent-fulfillment/queues/intent-fulfillment.queue';
/**
 * Service class for getting configs for the app
 */
export declare class FeasableIntentService {
    private readonly intentFulfillmentQueue;
    private readonly feeService;
    private readonly utilsIntentService;
    private readonly ecoAnalytics;
    private logger;
    constructor(intentFulfillmentQueue: IntentFulfillmentQueue, feeService: FeeService, utilsIntentService: UtilsIntentService, ecoAnalytics: EcoAnalyticsService);
    feasableQuote(quoteIntent: QuoteIntentModel): Promise<void>;
    /**
     * Validates that the execution of the intent is feasible. This means that the solver can execute
     * the transaction and that transaction cost is profitable to the solver.
     * @param intentHash the intent hash to fetch the intent data from the db with
     * @returns
     */
    feasableIntent(intentHash: Hex): Promise<void>;
}
