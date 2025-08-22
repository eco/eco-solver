import { WatchEventModel } from './watch-event.schema';
import { IntentDataModel } from './intent-data.schema';
import { GetTransactionReceiptReturnType } from 'viem';
export type IntentSourceStatus = 'PENDING' | 'SOLVED' | 'EXPIRED' | 'FAILED' | 'INVALID' | 'INFEASABLE' | 'NON-BEND-WALLET';
export declare class IntentSourceModel {
    event?: WatchEventModel;
    intent: IntentDataModel;
    receipt?: GetTransactionReceiptReturnType;
    status: IntentSourceStatus;
    static getSource(intentSourceModel: IntentSourceModel): bigint;
}
export declare const IntentSourceSchema: import("mongoose").Schema<IntentSourceModel, import("mongoose").Model<IntentSourceModel, any, any, any, import("mongoose").Document<unknown, any, IntentSourceModel, any, {}> & IntentSourceModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IntentSourceModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IntentSourceModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<IntentSourceModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
