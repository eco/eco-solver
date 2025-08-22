import { GaslessIntentDataDTO } from '@eco-solver/quote/dto/gasless-intent-data.dto';
import { QuoteRewardDataDTO, QuoteRewardDataType } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { QuoteRouteDataDTO, QuoteRouteDataInterface } from '@eco-solver/quote/dto/quote.route.data.dto';
/**
 * The DTO for the intent data. Similar to {@link IntentType} except modified to
 * include options for the solver to select fulfillment conditions, and with the
 * on-chain data fields removed.
 */
export declare class QuoteIntentDataDTO implements QuoteIntentDataInterface {
    quoteID: string;
    dAppID: string;
    intentExecutionTypes: string[];
    route: QuoteRouteDataDTO;
    reward: QuoteRewardDataDTO;
    gaslessIntentData?: GaslessIntentDataDTO;
}
export interface QuoteIntentDataInterface {
    dAppID?: string;
    route: QuoteRouteDataInterface;
    reward: QuoteRewardDataType;
}
