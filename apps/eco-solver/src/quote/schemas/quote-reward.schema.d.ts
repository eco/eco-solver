import { QuoteRewardDataType } from '@eco-solver/quote/dto/quote.reward.data.dto';
import { QuoteRewardTokenDataModel } from '@eco-solver/quote/schemas/quote-token.schema';
import { Hex } from 'viem';
export declare class QuoteRewardDataModel implements QuoteRewardDataType {
    creator: Hex;
    prover: Hex;
    deadline: bigint;
    nativeValue: bigint;
    tokens: QuoteRewardTokenDataModel[];
}
export declare const QuoteRewardDataSchema: import("mongoose").Schema<QuoteRewardDataModel, import("mongoose").Model<QuoteRewardDataModel, any, any, any, import("mongoose").Document<unknown, any, QuoteRewardDataModel, any, {}> & QuoteRewardDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuoteRewardDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<QuoteRewardDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<QuoteRewardDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
