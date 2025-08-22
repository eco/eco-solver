import { KmsSignParameters } from '@eco-solver/sign/kms-account/signKms';
import { SerializeTransactionFn, TransactionSerializable } from 'viem';
import { SignTransactionParameters, SignTransactionReturnType } from 'viem/accounts';
export declare function signKmsTransaction<serializer extends SerializeTransactionFn<TransactionSerializable> = SerializeTransactionFn<TransactionSerializable>, transaction extends Parameters<serializer>[0] = Parameters<serializer>[0]>(parameters: Omit<SignTransactionParameters<serializer, transaction>, 'privateKey'> & {
    config: Omit<KmsSignParameters, 'hash'>;
}): Promise<SignTransactionReturnType<serializer, transaction>>;
