import { Hex } from 'viem';
import { IntentCreatedEventLog, CallDataInterface, RewardTokensInterface } from '@eco-solver/contracts';
import { RouteDataModel } from '@eco-solver/intent/schemas/route-data.schema';
import { RewardDataModel } from '@eco-solver/intent/schemas/reward-data.schema';
import { IntentType } from '@eco-foundation/routes-ts';
export interface CreateIntentDataModelParams {
    quoteID?: string;
    hash: Hex;
    salt: Hex;
    source: bigint;
    destination: bigint;
    inbox: Hex;
    routeTokens: RewardTokensInterface[];
    calls: CallDataInterface[];
    creator: Hex;
    prover: Hex;
    deadline: bigint;
    nativeValue: bigint;
    rewardTokens: RewardTokensInterface[];
    logIndex: number;
    funder?: Hex;
}
export declare class IntentDataModel implements IntentType {
    quoteID?: string;
    hash: Hex;
    route: RouteDataModel;
    reward: RewardDataModel;
    logIndex: number;
    funder?: Hex;
    constructor(params: CreateIntentDataModelParams);
    static isNativeIntent(params: CreateIntentDataModelParams): boolean;
    static getHash(intentDataModel: IntentDataModel): {
        routeHash: `0x${string}`;
        rewardHash: `0x${string}`;
        intentHash: `0x${string}`;
    };
    static encode(intentDataModel: IntentDataModel): `0x${string}`;
    static fromEvent(event: IntentCreatedEventLog, logIndex: number): IntentDataModel;
    static toChainIntent(intent: IntentDataModel): IntentType;
}
export declare const IntentSourceDataSchema: import("mongoose").Schema<IntentDataModel, import("mongoose").Model<IntentDataModel, any, any, any, import("mongoose").Document<unknown, any, IntentDataModel, any, {}> & IntentDataModel & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IntentDataModel, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<IntentDataModel>, {}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & import("mongoose").FlatRecord<IntentDataModel> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
