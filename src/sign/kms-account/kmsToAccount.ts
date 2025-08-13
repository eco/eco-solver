import { signKms } from '@/sign/kms-account/signKms'
import { signKmsTransaction } from '@/sign/kms-account/signKmsTransaction'
import { signKmsTypedData } from '@/sign/kms-account/signKmsTypedData'
import { Signer, KMSWallets } from '@eco/foundation-eco-adapter'
import {
  CustomSource,
  getAddress,
  hashMessage,
  LocalAccount,
  NonceManager,
  Prettify,
  toHex,
} from 'viem'
import { toAccount } from 'viem/accounts'

export type KmsToAccountOptions = {
  nonceManager?: NonceManager | undefined
  keyID: string
}

/**
 * @description Creates an Account from a KMS signer.
 *
 * @returns A Private Key Account.
 */
export async function kmsToAccount(
  signer: Signer,
  wallets: KMSWallets,
  options: KmsToAccountOptions,
): Promise<KmsAccount> {
  const { nonceManager, keyID } = options
  const publicKey = toHex(await wallets.getPublickey(keyID))
  const addressHex = getAddress(await wallets.getAddressHex(keyID))
  const addressBuffer = await wallets.getAddress(keyID)

  const account = toAccount({
    address: addressHex,
    nonceManager,
    async sign({ hash }) {
      return await signKms({ hash, signer, keyID, addressBuffer, to: 'hex' })
    },
    async signMessage({ message }) {
      return await signKms({ hash: hashMessage(message), signer, keyID, addressBuffer, to: 'hex' })
    },
    async signTransaction(transaction, { serializer } = {}) {
      return await signKmsTransaction({
        transaction,
        serializer,
        config: { signer, keyID, addressBuffer },
      })
    },
    async signTypedData(typedData) {
      return await signKmsTypedData({
        ...typedData,
        config: { signer, keyID, addressBuffer },
      } as any)
    },
  })

  return {
    ...account,
    publicKey,
    source: 'kms',
  } as KmsAccount
}

export type KmsAccount = Prettify<
  LocalAccount<'kms'> & {
    // TODO(v3): This will be redundant.
    sign: NonNullable<CustomSource['sign']>
  }
>
