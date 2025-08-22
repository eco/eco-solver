import { KmsService } from '@eco-solver/kms/kms.service';
import { KmsAccount } from '@eco-solver/sign/kms-account/kmsToAccount';
import { OnModuleInit } from '@nestjs/common';
/**
 * A signer service that creates a {@link KmsAccount} from a KMS signer.
 * Uses the {@link KmsService} to get the KMS signer from aws.
 */
export declare class SignerKmsService implements OnModuleInit {
    readonly kmsService: KmsService;
    private account;
    constructor(kmsService: KmsService);
    onModuleInit(): Promise<void>;
    getAccount(): {
        address: import("viem").Address;
        nonceManager?: import("viem").NonceManager | undefined;
        sign: ((parameters: {
            hash: import("viem").Hash;
        }) => Promise<import("viem").Hex>) | undefined;
        signAuthorization?: ((parameters: import("viem").AuthorizationRequest) => Promise<import("viem/accounts").SignAuthorizationReturnType>) | undefined;
        signMessage: ({ message }: {
            message: import("viem").SignableMessage;
        }) => Promise<import("viem").Hex>;
        signTransaction: <serializer extends import("viem").SerializeTransactionFn<import("viem").TransactionSerializable> = import("viem").SerializeTransactionFn<import("viem").TransactionSerializable>, transaction extends Parameters<serializer>[0] = Parameters<serializer>[0]>(transaction: transaction, options?: {
            serializer?: serializer | undefined;
        } | undefined) => Promise<import("viem").IsNarrowable<import("viem").TransactionSerialized<import("viem").GetTransactionType<transaction>>, import("viem").Hex> extends true ? import("viem").TransactionSerialized<import("viem").GetTransactionType<transaction>> : import("viem").Hex>;
        signTypedData: <const typedData extends import("viem").TypedData | Record<string, unknown>, primaryType extends keyof typedData | "EIP712Domain" = keyof typedData>(parameters: import("viem").TypedDataDefinition<typedData, primaryType>) => Promise<import("viem").Hex>;
        publicKey: import("viem").Hex;
        source: "kms";
        type: "local";
    };
    protected buildAccount(): Promise<KmsAccount>;
}
