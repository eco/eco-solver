import { KernelVersion, ToEcdsaKernelSmartAccountParameters, ToEcdsaKernelSmartAccountReturnType } from 'permissionless/accounts';
import { Account, Chain, Client, ClientConfig, Hex, LocalAccount, OneOf, Prettify, RpcSchema, Transport, WalletClient } from 'viem';
import { SmartAccount } from 'viem/account-abstraction';
import { entryPointV_0_7 } from '@eco-solver/transaction/smart-wallets/kernel/create.kernel.account';
import { EthereumProvider } from 'permissionless/utils/toOwner';
import { KernelAccountClient } from '@zerodev/sdk';
import { KernelAccountClientConfig } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account.config';
import { ExecuteSmartWalletArgs } from '@eco-solver/transaction/smart-wallets/smart-wallet.types';
export type KernelAccountClientV2Config<entryPointVersion extends '0.6' | '0.7', kernelVersion extends KernelVersion<entryPointVersion>, owner extends OneOf<EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount>, transport extends Transport = Transport, chain extends Chain | undefined = Chain | undefined, account extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined = ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined, rpcSchema extends RpcSchema | undefined = undefined> = Prettify<ClientConfig<transport, chain, account, rpcSchema> & ToEcdsaKernelSmartAccountParameters<entryPointVersion, kernelVersion, owner> & {
    ownerAccount: Account;
}>;
export declare function createKernelAccountClientV2<entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7, owner extends OneOf<EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount> = LocalAccount>(parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>): Promise<KernelAccountClient<Transport, Chain, SmartAccount, Client>>;
export declare function executeTransactionsWithKernel(kernelClient: KernelAccountClient, walletClient: WalletClient<Transport, Chain, Account>, transactions: ExecuteSmartWalletArgs): Promise<Hex>;
