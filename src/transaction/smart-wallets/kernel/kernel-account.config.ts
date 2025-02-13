import { KernelVersion, ToEcdsaKernelSmartAccountParameters } from 'permissionless/accounts'
import {
  Account,
  Chain,
  LocalAccount,
  OneOf,
  Prettify,
  Transport,
  WalletClient,
  WalletClientConfig,
} from 'viem'
import { SmartWalletActions } from '../smart-wallet.types'
import { DeployFactoryArgs } from './kernel-account.client'
import { EthereumProvider } from 'permissionless/utils/toOwner'

export type KernelAccountClientConfig<
  entryPointVersion extends '0.6' | '0.7',
  kernelVersion extends KernelVersion<entryPointVersion>,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  >,
> = WalletClientConfig &
  ToEcdsaKernelSmartAccountParameters<entryPointVersion, kernelVersion, owner>

export type KernelWalletActions = Prettify<
  SmartWalletActions & {
    deployKernelAccount: () => Promise<DeployFactoryArgs>
  }
>

export const isKernelV2 = (version: KernelVersion<'0.6' | '0.7'>): boolean => {
  const regex = /0\.2\.\d+/
  return regex.test(version)
}
