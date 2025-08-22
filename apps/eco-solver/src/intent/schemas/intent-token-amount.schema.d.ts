import { RewardTokensInterface } from '@eco-solver/contracts';
import { Hex } from 'viem';
export declare class TokenAmountDataModel implements RewardTokensInterface {
    token: Hex;
    amount: bigint;
}
export declare const TokenAmountDataSchema: import("mongoose").Schema<TokenAmountDataModel, import("mongoose").Model<TokenAmountDataModel, any, any, any, import("mongoose").Document<unknown, any, TokenAmountDataModel, any, {}> & TokenAmountDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, TokenAmountDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<TokenAmountDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<TokenAmountDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
