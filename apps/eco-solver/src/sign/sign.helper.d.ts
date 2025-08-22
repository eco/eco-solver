import { NonceManagerSource, PrivateKeyAccount } from 'viem';
import { Hex } from 'viem';
import { AtomicKeyParams } from './atomic.nonce.service';
export declare function privateKeyAndNonceToAccountSigner(atomicNonceSource: NonceManagerSource, privateKey: Hex): PrivateKeyAccount;
export declare function getAtomicNonceKey(params: AtomicKeyParams): string;
export declare function getAtomicNonceVals(key: string): AtomicKeyParams;
