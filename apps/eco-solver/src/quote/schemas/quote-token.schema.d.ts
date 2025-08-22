import { RewardTokensInterface } from '@eco-solver/contracts';
import { Hex } from 'viem';
export declare class QuoteRewardTokenDataModel implements RewardTokensInterface {
    token: Hex;
    amount: bigint;
}
export declare const QuoteRewardTokenDataSchema: import("mongoose").Schema<QuoteRewardTokenDataModel, import("mongoose").Model<QuoteRewardTokenDataModel, any, any, any, import("mongoose").Document<unknown, any, QuoteRewardTokenDataModel, any, {}> & QuoteRewardTokenDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuoteRewardTokenDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<QuoteRewardTokenDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<QuoteRewardTokenDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
