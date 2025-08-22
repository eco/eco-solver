import * as mongoose from 'mongoose';
export declare class TestDBModel {
    name: string;
}
export declare const testMongooseSchema: mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    name?: string;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    name?: string;
}>, {}, mongoose.ResolveSchemaOptions<mongoose.DefaultSchemaOptions>> & mongoose.FlatRecord<{
    name?: string;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
