import { EcoConfigService } from '@libs/solver-config';
import { Solver } from '@libs/solver-config';
import { QuoteIntentDataInterface } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { OnModuleInit } from '@nestjs/common';
/**
 * Service for estimating fulfillment times for intents
 */
export declare class FulfillmentEstimateService implements OnModuleInit {
    private readonly ecoConfigService;
    private logger;
    private fulfillmentConfig;
    constructor(ecoConfigService: EcoConfigService);
    onModuleInit(): void;
    /**
     * Returns the estimated fulfillment time in seconds
     * @param quoteIntentModel the quote intent model
     * @returns the estimated fulfillment time in seconds
     */
    getEstimatedFulfillTime(quoteIntentModel: QuoteIntentDataInterface): number;
    /**
     * Returns the average block time for the given solver. Falls back to defaultBlockTime if
     * averageBlockTime is not defined in the solver.
     * @param solver The solver to get the average block time for
     * @returns The average block time in seconds
     */
    getAverageBlockTime(solver: Solver | undefined): number;
}
