import { Signer } from '@eco-foundation/eco-kms-core';
import { Hex } from 'viem';
import { SignReturnType } from 'viem/accounts';
export type To = 'object' | 'bytes' | 'hex';
export type KmsSignParameters<to extends To = 'object'> = {
    hash: Hex;
    signer: Signer;
    keyID: string;
    addressBuffer: Buffer;
    to?: to | To | undefined;
};
/**
 * @description Signs a hash using a KMS signer.
 *
 * @returns A signature.
 */
export declare function signKms<to extends To = 'object'>(config: KmsSignParameters<to>): Promise<SignReturnType<to>>;
