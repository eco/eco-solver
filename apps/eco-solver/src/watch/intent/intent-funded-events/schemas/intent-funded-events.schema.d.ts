import { WatchEventModel } from '@eco-solver/intent/schemas/watch-event.schema';
export declare class IntentFundedEventModel extends WatchEventModel {
}
export declare const IntentFundedEventSchema: import("mongoose").Schema<IntentFundedEventModel, import("mongoose").Model<IntentFundedEventModel, any, any, any, import("mongoose").Document<unknown, any, IntentFundedEventModel, any, {}> & IntentFundedEventModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IntentFundedEventModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IntentFundedEventModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<IntentFundedEventModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
