import { Account, Chain, Hex, LocalAccount, OneOf, Transport, WalletClient } from 'viem';
import { KernelAccountClientConfig } from './kernel-account.config';
import { DeployFactoryArgs, KernelAccountClient } from './kernel-account.client';
import { EthereumProvider } from 'permissionless/utils/toOwner';
import { KernelVersion } from 'permissionless/accounts';
export type entryPointV_0_7 = '0.7';
/**
 * Creates a kernel account client with a kernel account.
 *
 * @param parameters the kernel account client config
 * @returns
 */
export declare function createKernelAccountClient<entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7, owner extends OneOf<EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount> = LocalAccount>(parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>): Promise<{
    client: KernelAccountClient<entryPointVersion>;
    args: DeployFactoryArgs;
}>;
/**
 * Adds a {@link OwnableExecutor} module to the kernel account. The module is used to
 * execute transactions on behalf of the kernel account. Owner is usually
 * a multisig safe account.
 *
 * @param client the kernel account client
 * @param owner the owner to add to the kernel account, a multisig usually
 */
export declare function addExecutorToKernelAccount<entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7>(client: KernelAccountClient<entryPointVersion>, owner: Hex): Promise<void>;
/**
 * Encodes the calldata for the OwnableExecutor executeOnOwnedAccount function in order to
 * transfer an erc20 token owned by the kernel account.
 * @param kernelAccountAddress the kernel account address
 * @param tx the transfer transaction on the erc20 token to encode
 * @returns
 */
export declare function getExecutorTransferData(kernelAccountAddress: Hex, tx: {
    to: Hex;
    amount: bigint;
    tokenAddress: Hex;
}): `0x${string}`;
/**
 * Transfers an ERC20 token from an OwnableExecutor eip-7975 module. It
 * calls the underlying `executeOnOwnedAccount` function of the module that then calls the
 * owned Kernel wallet. Serves for generating the calldata needed for the transfer.
 * Calldata should be executed on the executor contract.
 *
 * @param client the kernel account client
 * @param tx the token tx data
 */
export declare function executorTransferERC20Token<entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7>(client: KernelAccountClient<entryPointVersion>, tx: {
    to: Hex;
    amount: bigint;
    tokenAddress: Hex;
}): Promise<void>;
