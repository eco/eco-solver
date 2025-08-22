import { TokenAmountDataModel } from '@eco-solver/intent/schemas/intent-token-amount.schema';
import { RewardType } from '@eco-foundation/routes-ts';
import { Hex } from 'viem';
export declare class RewardDataModel implements RewardType {
    creator: Hex;
    prover: Hex;
    deadline: bigint;
    nativeValue: bigint;
    tokens: TokenAmountDataModel[];
    constructor(creator: Hex, prover: Hex, deadline: bigint, nativeValue: bigint, tokens: TokenAmountDataModel[]);
    static getHash(intentDataModel: RewardDataModel): `0x${string}`;
    static encode(intentDataModel: RewardDataModel): `0x${string}`;
}
export declare const RewardDataModelSchema: import("mongoose").Schema<RewardDataModel, import("mongoose").Model<RewardDataModel, any, any, any, import("mongoose").Document<unknown, any, RewardDataModel, any, {}> & RewardDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RewardDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<RewardDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<RewardDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
