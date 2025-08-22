import { CallDataInterface } from '@eco-solver/contracts';
import { Hex } from 'viem';
export declare class TargetCallDataModel implements CallDataInterface {
    target: Hex;
    data: Hex;
    value: bigint;
}
export declare const TargetCallDataSchema: import("mongoose").Schema<TargetCallDataModel, import("mongoose").Model<TargetCallDataModel, any, any, any, import("mongoose").Document<unknown, any, TargetCallDataModel, any, {}> & TargetCallDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, TargetCallDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<TargetCallDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<TargetCallDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
