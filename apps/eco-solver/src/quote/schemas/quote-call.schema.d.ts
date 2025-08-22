import { CallDataInterface } from '@eco-solver/contracts';
import { Hex } from 'viem';
export declare class QuoteRouteCallDataModel implements CallDataInterface {
    target: Hex;
    data: Hex;
    value: bigint;
}
export declare const QuoteRouteCallDataSchema: import("mongoose").Schema<QuoteRouteCallDataModel, import("mongoose").Model<QuoteRouteCallDataModel, any, any, any, import("mongoose").Document<unknown, any, QuoteRouteCallDataModel, any, {}> & QuoteRouteCallDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, QuoteRouteCallDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<QuoteRouteCallDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<QuoteRouteCallDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
