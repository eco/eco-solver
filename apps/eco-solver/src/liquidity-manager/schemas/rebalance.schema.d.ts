import { RebalanceTokenModel } from './rebalance-token.schema';
import { Strategy, StrategyContext } from '@eco-solver/liquidity-manager/types/types';
export declare class RebalanceModel {
    wallet?: string;
    tokenIn: RebalanceTokenModel;
    tokenOut: RebalanceTokenModel;
    amountIn: bigint;
    amountOut: bigint;
    slippage: number;
    strategy: Strategy;
    groupId?: string;
    context?: StrategyContext;
}
export declare const RebalanceSchema: import("mongoose").Schema<RebalanceModel, import("mongoose").Model<RebalanceModel, any, any, any, import("mongoose").Document<unknown, any, RebalanceModel, any, {}> & RebalanceModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RebalanceModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<RebalanceModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<RebalanceModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
