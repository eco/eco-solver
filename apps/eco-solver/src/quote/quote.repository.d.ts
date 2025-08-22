import { EcoConfigService } from '@libs/solver-config';
import { EcoResponse } from '@eco-solver/common/eco-response';
import { FilterQuery, Model } from 'mongoose';
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { QuoteIntentModel } from '@eco-solver/quote/schemas/quote-intent.schema';
import { UpdateQuoteParams } from '@eco-solver/quote/interfaces/update-quote-params.interface';
import { EcoAnalyticsService } from '@eco-solver/analytics';
type QuoteQuery = FilterQuery<QuoteIntentModel>;
/**
 * QuoteRepository is responsible for interacting with the database to store and fetch quote intent data.
 */
export declare class QuoteRepository {
    private quoteIntentModel;
    private readonly ecoConfigService;
    private readonly ecoAnalytics;
    private logger;
    private quotesConfig;
    constructor(quoteIntentModel: Model<QuoteIntentModel>, ecoConfigService: EcoConfigService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): void;
    /**
     * Stores the quote into the db
     * @param quoteIntentDataDTO the quote intent data
     * @returns the stored record or an error
     */
    storeQuoteIntentData(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<EcoResponse<QuoteIntentModel[]>>;
    /**
     * Stores a single quote model into the database
     * @param quoteModelData the quote model data to store
     * @returns the stored record or an error
     */
    private storeQuoteIntentDataForExecutionType;
    /**
     * Creates a quote model data object from DTO
     * @param intentExecutionType the intent execution type
     * @param quoteIntentDataDTO the quote intent data DTO
     * @returns the quote model data
     */
    private createQuoteModelData;
    /**
     * Fetch a quote from the db
     * @param query the quote query filter
     * @returns the quote or an error
     */
    fetchQuoteIntentData(query: QuoteQuery): Promise<EcoResponse<QuoteIntentModel>>;
    /**
     * Checks if a quote exists in the db
     * @param query the quote query filter
     * @returns true if the quote exists, false otherwise
     */
    quoteExists(query: QuoteQuery): Promise<boolean>;
    /**
     * Updates the quote intent model in the db
     * @param quoteIntentModel the model to update
     * @param updateQuoteParams the update parameters
     * @returns the updated model or an error
     */
    updateQuoteDb(quoteIntentModel: QuoteIntentModel, updateQuoteParams: UpdateQuoteParams): Promise<EcoResponse<QuoteIntentModel>>;
    /**
     * Validates quote intent data
     * @param quoteIntentDataDTO the quote intent data to validate
     * @returns validation result
     */
    private validateQuoteIntentData;
    /**
     * Gets supported intent execution types from config
     * @returns array of supported types
     */
    private getSupportedIntentExecutionTypes;
    /**
     * Builds update query for quote model
     * @param quoteIntentModel the original model
     * @param updateQuoteParams the update parameters
     * @returns the update query
     */
    private buildUpdateQuery;
}
export {};
