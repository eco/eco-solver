import { KmsSignParameters } from '@eco-solver/sign/kms-account/signKms';
import { SignTypedDataReturnType, TypedData } from 'viem';
import { SignTypedDataParameters } from 'viem/accounts';
export declare function signKmsTypedData<const typedData extends TypedData | Record<string, unknown>, primaryType extends keyof typedData | 'EIP712Domain'>(parameters: Omit<SignTypedDataParameters<typedData, primaryType>, 'privateKey'> & {
    config: Omit<KmsSignParameters, 'hash'>;
}): Promise<SignTypedDataReturnType>;
