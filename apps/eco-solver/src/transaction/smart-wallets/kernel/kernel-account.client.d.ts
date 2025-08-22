import { Account, Chain, Hex, Prettify, RpcSchema, Transport, WalletRpcSchema } from 'viem';
import { SmartWalletClient } from '../smart-wallet.types';
import { ToEcdsaKernelSmartAccountReturnType } from 'permissionless/accounts';
import { KernelWalletActions } from './kernel-account.config';
export type DeployFactoryArgs = {
    factory?: Hex | undefined;
    factoryData?: Hex | undefined;
    deployReceipt?: Hex | undefined;
    chainID?: number;
};
export type KernelAccountClient<entryPointVersion extends '0.6' | '0.7', transport extends Transport = Transport, chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined, rpcSchema extends RpcSchema | undefined = undefined> = Prettify<SmartWalletClient<transport, chain, account, rpcSchema extends RpcSchema ? [...WalletRpcSchema, ...rpcSchema] : WalletRpcSchema> & {
    kernelAccount: ToEcdsaKernelSmartAccountReturnType<entryPointVersion>;
    kernelAccountAddress: Hex;
}>;
export declare function KernelAccountActions<entryPointVersion extends '0.6' | '0.7', transport extends Transport, chain extends Chain | undefined = Chain | undefined, account extends Account | undefined = Account | undefined>(client: KernelAccountClient<entryPointVersion, transport, chain, account>): KernelWalletActions;
