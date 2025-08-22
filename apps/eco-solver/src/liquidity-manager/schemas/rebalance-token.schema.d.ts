import { TokenData } from '@eco-solver/liquidity-manager/types/types';
import { Hex } from 'viem';
export declare class RebalanceTokenModel {
    chainId: number;
    tokenAddress: Hex;
    currentBalance: number;
    targetBalance: number;
    static fromTokenData(tokenData: TokenData): RebalanceTokenModel;
}
export declare const RebalanceTokenSchema: import("mongoose").Schema<RebalanceTokenModel, import("mongoose").Model<RebalanceTokenModel, any, any, any, import("mongoose").Document<unknown, any, RebalanceTokenModel, any, {}> & RebalanceTokenModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RebalanceTokenModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<RebalanceTokenModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<RebalanceTokenModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
