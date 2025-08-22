import { PublicClient } from 'viem';
import { Hex } from 'viem';
import { HyperlaneConfig } from '@libs/solver-config';
export declare function estimateMessageGas(publicClient: PublicClient, mailboxAddr: Hex, handlerAddr: Hex, origin: number, sender: Hex, message: Hex): Promise<bigint>;
export declare function estimateFee(publicClient: PublicClient, mailboxAddr: Hex, destination: number, recipient: Hex, messageBody: Hex, metadata: Hex, hook: Hex): Promise<bigint>;
export declare function getChainMetadata(hyperlaneConfig: HyperlaneConfig, chainId: number): any;
export declare function getMessageData(claimant: Hex, hashes: Hex[]): `0x${string}`;
export declare function getMetadata(value: bigint, gasLimit: bigint): `0x${string}`;
