import { Signer } from '@eco-foundation/eco-kms-core';
import { KMSProviderAWS } from '@eco-foundation/eco-kms-provider-aws';
import { KMSWallets } from '@eco-foundation/eco-kms-wallets';
import { getAddress, LocalAccount, toHex } from 'viem';
import { toAccount } from 'viem/accounts';

import { KmsSignerConfig } from '@/config/schemas';

import { sign, signMessage, signTransaction, signTypedData } from './actions';

/**
 * @description Creates an Account from a KMS signer.
 *
 * @returns A Private Key Account.
 */
export async function kmsToAccount(options: KmsSignerConfig) {
  const provider = new KMSProviderAWS({
    region: options.region,
    credentials: options.credentials as Required<KmsSignerConfig['credentials']>,
  });
  const wallets = new KMSWallets(provider);
  const signer = new Signer(wallets);

  const { keyID } = options;

  const [publicKeyBuffer, addressBuffer, _addressHex] = await Promise.all([
    await wallets.getPublickey(keyID),
    await wallets.getAddress(keyID),
    await wallets.getAddressHex(keyID),
  ]);

  const publicKey = toHex(publicKeyBuffer);
  const addressHex = getAddress(_addressHex);

  const kmsOpts = { signer, keyID, addressBuffer };

  const account = toAccount({
    address: addressHex,
    sign: sign(kmsOpts),
    signMessage: signMessage(kmsOpts),
    signTransaction: signTransaction(kmsOpts),
    signTypedData: signTypedData(kmsOpts),
  });

  return {
    ...account,
    publicKey,
    source: 'kms',
  } as LocalAccount;
}
