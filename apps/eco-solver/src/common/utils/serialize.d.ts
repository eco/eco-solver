type SerializedBigInt = {
    type: 'BigInt';
    hex: string;
};
export type Serialize<T> = T extends bigint ? SerializedBigInt : {
    [K in keyof T]: T[K] extends bigint ? SerializedBigInt : T[K] extends object ? Serialize<T[K]> : T[K];
};
export type Deserialize<T> = T extends SerializedBigInt ? bigint : T extends object ? {
    [K in keyof T]: T[K] extends SerializedBigInt ? bigint : T[K] extends object ? Deserialize<T[K]> : T[K];
} : T;
export declare function deserialize<T extends object | string>(data: T): Deserialize<T>;
export declare function serialize<T extends object | bigint>(data: T): Serialize<T>;
export {};
