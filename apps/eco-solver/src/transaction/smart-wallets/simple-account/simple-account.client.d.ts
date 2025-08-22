import { Hex, Transport, Chain, Account, RpcSchema, Prettify, WalletRpcSchema } from 'viem';
import { SmartWalletActions, SmartWalletClient } from '../smart-wallet.types';
export type SimpleAccountClient<transport extends Transport = Transport, chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, rpcSchema extends RpcSchema | undefined = undefined> = Prettify<SmartWalletClient<transport, chain, account, rpcSchema extends RpcSchema ? [...WalletRpcSchema, ...rpcSchema] : WalletRpcSchema> & {
    simpleAccountAddress: Hex;
}>;
export declare function SimpleAccountActions<transport extends Transport, chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined>(client: SimpleAccountClient<transport, chain, account>): Omit<SmartWalletActions, 'deployKernelAccount'>;
