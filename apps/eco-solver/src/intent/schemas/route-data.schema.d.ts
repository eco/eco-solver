import { TargetCallDataModel } from '@eco-solver/intent/schemas/intent-call-data.schema';
import { TokenAmountDataModel } from '@eco-solver/intent/schemas/intent-token-amount.schema';
import { RouteType } from '@eco-foundation/routes-ts';
import { Hex } from 'viem';
export declare class RouteDataModel implements RouteType {
    salt: Hex;
    source: bigint;
    destination: bigint;
    inbox: Hex;
    tokens: TokenAmountDataModel[];
    calls: TargetCallDataModel[];
    constructor(salt: Hex, source: bigint, destination: bigint, inbox: Hex, routeTokens: TokenAmountDataModel[], calls: TargetCallDataModel[]);
}
export declare const RouteDataSchema: import("mongoose").Schema<RouteDataModel, import("mongoose").Model<RouteDataModel, any, any, any, import("mongoose").Document<unknown, any, RouteDataModel, any, {}> & RouteDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RouteDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<RouteDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<RouteDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
