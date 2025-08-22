import { DecodeEventLogReturnType, GetEventArgs, Log, Prettify } from 'viem';
import { Hex } from 'viem';
import { ExtractAbiEvent } from 'abitype';
import { Network } from '@eco-solver/common/alchemy/network';
import { IntentSourceAbi } from '@eco-foundation/routes-ts';
import { CallDataType, RewardTokensType } from '@eco-solver/quote/dto/types';
export type IntentCreatedEventViemType = Prettify<GetEventArgs<typeof IntentSourceAbi, 'IntentCreated', {
    EnableUnion: true;
    IndexedOnly: false;
    Required: false;
}> & {
    hash: Hex;
    logIndex: number;
}>;
/**
 * Define the interface for the calls field in the IntentSource event
 */
export type CallDataInterface = CallDataType;
/**
 * Define the interface for the token amount field in the IntentSource event
 */
export type RewardTokensInterface = RewardTokensType;
/**
 * Define the type for the IntentSource event log
 */
export type IntentCreatedEventLog = DecodeEventLogReturnType<typeof IntentSourceAbi, 'IntentCreated'>;
export type IntentCreatedLog = Prettify<Log<bigint, number, false, ExtractAbiEvent<typeof IntentSourceAbi, 'IntentCreated'>, true> & {
    sourceNetwork: Network;
    sourceChainID: bigint;
}>;
export declare function decodeCreateIntentLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []): {
    eventName: "IntentCreated";
    args: {
        hash: `0x${string}`;
        salt: `0x${string}`;
        source: bigint;
        destination: bigint;
        inbox: `0x${string}`;
        routeTokens: readonly {
            token: `0x${string}`;
            amount: bigint;
        }[];
        calls: readonly {
            target: `0x${string}`;
            data: `0x${string}`;
            value: bigint;
        }[];
        creator: `0x${string}`;
        prover: `0x${string}`;
        deadline: bigint;
        nativeValue: bigint;
        rewardTokens: readonly {
            token: `0x${string}`;
            amount: bigint;
        }[];
    };
};
export type IntentFundedEventViemType = Prettify<GetEventArgs<typeof IntentSourceAbi, 'IntentFunded', {
    EnableUnion: true;
    IndexedOnly: false;
    Required: false;
}> & {
    hash: Hex;
    logIndex: number;
}>;
/**
 * Define the type for the IntentSource event log
 */
export type IntentFundedEventLog = DecodeEventLogReturnType<typeof IntentSourceAbi, 'IntentFunded'>;
export type IntentFundedLog = Prettify<Log<bigint, number, false, ExtractAbiEvent<typeof IntentSourceAbi, 'IntentFunded'>, true> & {
    sourceNetwork: Network;
    sourceChainID: bigint;
}>;
export declare function decodeIntentFundedLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []): {
    eventName: "IntentFunded";
    args: {
        intentHash: `0x${string}`;
        funder: `0x${string}`;
    };
};
