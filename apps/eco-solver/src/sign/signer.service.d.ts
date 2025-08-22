import { OnModuleInit } from '@nestjs/common';
import { PrivateKeyAccount } from 'viem';
import { Hex } from 'viem';
import { EcoConfigService } from '@libs/solver-config';
export declare class SignerService implements OnModuleInit {
    readonly ecoConfigService: EcoConfigService;
    private account;
    constructor(ecoConfigService: EcoConfigService);
    onModuleInit(): void;
    getAccount(): {
        address: import("viem").Address;
        nonceManager?: import("viem").NonceManager | undefined;
        sign: ((parameters: {
            hash: import("viem").Hash;
        }) => Promise<Hex>) | undefined;
        signAuthorization: ((parameters: import("viem").AuthorizationRequest) => Promise<import("viem/accounts").SignAuthorizationReturnType>) | undefined;
        signMessage: ({ message }: {
            message: import("viem").SignableMessage;
        }) => Promise<Hex>;
        signTransaction: <serializer extends import("viem").SerializeTransactionFn<import("viem").TransactionSerializable> = import("viem").SerializeTransactionFn<import("viem").TransactionSerializable>, transaction extends Parameters<serializer>[0] = Parameters<serializer>[0]>(transaction: transaction, options?: {
            serializer?: serializer | undefined;
        } | undefined) => Promise<import("viem").IsNarrowable<import("viem").TransactionSerialized<import("viem").GetTransactionType<transaction>>, Hex> extends true ? import("viem").TransactionSerialized<import("viem").GetTransactionType<transaction>> : Hex>;
        signTypedData: <const typedData extends import("viem").TypedData | Record<string, unknown>, primaryType extends keyof typedData | "EIP712Domain" = keyof typedData>(parameters: import("viem").TypedDataDefinition<typedData, primaryType>) => Promise<Hex>;
        publicKey: Hex;
        source: "privateKey";
        type: "local";
    };
    protected buildAccount(): PrivateKeyAccount;
    protected getPrivateKey(): Hex;
}
