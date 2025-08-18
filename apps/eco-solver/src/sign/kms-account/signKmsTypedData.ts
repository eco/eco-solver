import { KmsSignParameters, signKms } from '@/sign/kms-account/signKms'
import { hashTypedData, SignTypedDataReturnType, TypedData } from 'viem'
import { SignTypedDataParameters } from 'viem/accounts'

export async function signKmsTypedData<
  const typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
>(
  parameters: Omit<SignTypedDataParameters<typedData, primaryType>, 'privateKey'> & {
    config: Omit<KmsSignParameters, 'hash'>
  },
): Promise<SignTypedDataReturnType> {
  const { config, ...typedData } = parameters as unknown as SignTypedDataParameters & {
    config: Omit<KmsSignParameters, 'hash'>
  }
  return await signKms({
    hash: hashTypedData(typedData),
    ...config,
    to: 'hex',
  })
}
