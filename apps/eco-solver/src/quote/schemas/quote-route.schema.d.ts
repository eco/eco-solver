import { TokenAmountDataModel } from '@eco-solver/intent/schemas/intent-token-amount.schema';
import { QuoteRouteDataInterface } from '@eco-solver/quote/dto/quote.route.data.dto';
import { QuoteRouteCallDataModel } from '@eco-solver/quote/schemas/quote-call.schema';
import { Hex } from 'viem';
export declare class QuoteRouteDataModel implements QuoteRouteDataInterface {
    source: bigint;
    destination: bigint;
    inbox: Hex;
    tokens: TokenAmountDataModel[];
    calls: QuoteRouteCallDataModel[];
}
export declare const QuoteRouteDataSchema: import("mongoose").Schema<QuoteRouteDataModel, import("mongoose").Model<QuoteRouteDataModel, any, any, any, import("mongoose").Document<unknown, any, QuoteRouteDataModel, any, {}> & QuoteRouteDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuoteRouteDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<QuoteRouteDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<QuoteRouteDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
