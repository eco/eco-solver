import { QuoteDataDTO } from '@eco-solver/quote/dto/quote-data.dto';
import { QuoteIntentDataDTO } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { QuoteService } from '@eco-solver/quote/quote.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
export declare class QuoteController {
    private readonly quoteService;
    private readonly ecoAnalytics;
    private logger;
    constructor(quoteService: QuoteService, ecoAnalytics: EcoAnalyticsService);
    getQuote(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO>;
    getReverseQuote(quoteIntentDataDTO: QuoteIntentDataDTO): Promise<QuoteDataDTO>;
}
