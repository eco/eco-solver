import { QuoteIntentDataInterface } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { QuoteRewardDataModel } from '@eco-solver/quote/schemas/quote-reward.schema';
import { QuoteRouteDataModel } from '@eco-solver/quote/schemas/quote-route.schema';
import { Types } from 'mongoose';
export declare class QuoteIntentModel implements QuoteIntentDataInterface {
    _id: Types.ObjectId;
    quoteID: string;
    dAppID: string;
    intentExecutionType: string;
    route: QuoteRouteDataModel;
    reward: QuoteRewardDataModel;
    receipt?: any;
}
export declare const QuoteIntentSchema: import("mongoose").Schema<QuoteIntentModel, import("mongoose").Model<QuoteIntentModel, any, any, any, import("mongoose").Document<unknown, any, QuoteIntentModel, any, {}> & QuoteIntentModel & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuoteIntentModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<QuoteIntentModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<QuoteIntentModel> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
