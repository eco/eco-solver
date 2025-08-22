import { NonceManagerSource, Prettify, PublicClient } from 'viem';
import { Hex } from 'viem';
import type { Address } from 'abitype';
import { Model } from 'mongoose';
import type { Client } from 'viem/_types/clients/createClient';
import { Logger } from '@nestjs/common';
export type AtomicKeyParams = {
    address: Hex;
    chainId: number;
};
export type AtomicKeyClientParams = Prettify<Pick<AtomicKeyParams, 'address'> & {
    client: PublicClient;
}>;
export type AtomicGetParameters = Prettify<AtomicKeyParams & {
    client: Client;
}>;
/** An atomic JSON-RPC source for a nonce manager. It initializes the nonce
 * to the current RPC returned transaction count, then it stores and increments
 * the nonce through an atomic call locally. Ie. a database that can enforce atomicity.
 *
 * This way the account for the nonce can be shared amongs multiple processes simultaneously without
 * the treat of nonce collisions. Such as in a kubernetes cluster.
 */
export declare abstract class AtomicNonceService<T extends {
    nonce: number;
}> implements NonceManagerSource {
    protected model: Model<T>;
    protected logger: Logger;
    constructor(model: Model<T>);
    syncNonces(): Promise<void>;
    get(parameters: AtomicGetParameters): Promise<number>;
    set(params: AtomicGetParameters, nonce: number): Promise<void>;
    getIncNonce(parameters: AtomicGetParameters): Promise<number>;
    protected getSyncParams(): Promise<AtomicKeyClientParams[]>;
    getNonces(): Promise<T[]>;
    static getNonceQueueKey(address: Address, chainId: number): string;
}
