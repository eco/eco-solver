import { Signer } from '@eco-foundation/eco-kms-core';
import { KMSWallets } from '@eco-foundation/eco-kms-wallets';
import { CustomSource, LocalAccount, NonceManager, Prettify } from 'viem';
export type KmsToAccountOptions = {
    nonceManager?: NonceManager | undefined;
    keyID: string;
};
/**
 * @description Creates an Account from a KMS signer.
 *
 * @returns A Private Key Account.
 */
export declare function kmsToAccount(signer: Signer, wallets: KMSWallets, options: KmsToAccountOptions): Promise<KmsAccount>;
export type KmsAccount = Prettify<LocalAccount<'kms'> & {
    sign: NonNullable<CustomSource['sign']>;
}>;
