import { Signer } from '@web3-kms-signer/core'
import { Hex, parseSignature } from 'viem'
import { SignReturnType } from 'viem/accounts'

export type To = 'object' | 'bytes' | 'hex'

export type KmsSignParameters<to extends To = 'object'> = {
  hash: Hex
  signer: Signer
  keyID: string
  addressBuffer: Buffer
  to?: to | To | undefined
}
/**
 * @description Signs a hash using a KMS signer.
 *
 * @returns A signature.
 */
export async function signKms<to extends To = 'object'>(
  config: KmsSignParameters<to>,
): Promise<SignReturnType<to>> {
  const { hash, signer, keyID, addressBuffer, to = 'object' } = config
  const hexSig = (await signer.signDigest({ keyId: keyID, address: addressBuffer }, hash)) as Hex
  return (() => {
    if (to === 'bytes' || to === 'hex') {
      return hexSig
    }
    return parseSignature(hexSig)
  })() as SignReturnType<to>
}
