import { AtomicKeyParams } from '../atomic.nonce.service';
import { Hex } from 'viem';
export declare class Nonce {
    key: string;
    nonce: number;
    chainID: number;
    address: Hex;
    createdAt: Date;
    updatedAt: Date;
    toString(): string;
    getAtomicNonceVals(): AtomicKeyParams;
}
export declare const NonceSchema: import("mongoose").Schema<Nonce, import("mongoose").Model<Nonce, any, any, any, import("mongoose").Document<unknown, any, Nonce, any, {}> & Nonce & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Nonce, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Nonce>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<Nonce> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
