import { Network } from '@eco-solver/common/alchemy/network';
import { ViemEventLog } from '../../common/events/viem';
import { Hex } from 'viem';
export declare class WatchEventModel implements ViemEventLog {
    sourceChainID: bigint;
    sourceNetwork: Network;
    blockNumber: bigint;
    blockHash: Hex;
    transactionIndex: number;
    removed: boolean;
    address: Hex;
    data: Hex;
    topics: [] | [Hex, ...Hex[]];
    transactionHash: Hex;
    logIndex: number;
}
export declare const WatchEventSchema: import("mongoose").Schema<WatchEventModel, import("mongoose").Model<WatchEventModel, any, any, any, import("mongoose").Document<unknown, any, WatchEventModel, any, {}> & WatchEventModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, WatchEventModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<WatchEventModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<WatchEventModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
