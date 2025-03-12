import {
  Account,
  Chain,
  createWalletClient,
  LocalAccount,
  OneOf,
  publicActions,
  Transport,
  WalletClient,
} from 'viem'
import { KernelAccountClientConfig } from './kernel-account.config'
import {
  DeployFactoryArgs,
  KernelAccountActions,
  KernelAccountClient,
} from './kernel-account.client'
import { EthereumProvider } from 'permissionless/utils/toOwner'
import { KernelVersion } from 'permissionless/accounts'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { entryPoint07Address, EntryPointVersion } from 'viem/account-abstraction'
import { createKernelAccount } from '@zerodev/sdk'
import { getAccount, getOwnableExecutor, installModule } from '@rhinestone/module-sdk'

export type entryPointV_0_7 = '0.7'

export async function createKernelAccountClient<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  > = LocalAccount,
>(
  parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>,
): Promise<{ client: KernelAccountClient<entryPointVersion>; args: DeployFactoryArgs }> {
  const { key = 'kernelAccountClient', name = 'Kernel Account Client', transport } = parameters
  const { account } = parameters

  let walletClient = createWalletClient({
    ...parameters,
    account,
    key,
    name,
    transport,
  }) as KernelAccountClient<entryPointVersion>
  const kernelVersion = KERNEL_V3_1
  const entryPoint = {
    address: entryPoint07Address,
    version: '0.7' as EntryPointVersion,
  }

  const ecdsaValidator = await signerToEcdsaValidator(walletClient, {
    signer: account as LocalAccount,
    entryPoint: entryPoint!,
    kernelVersion,
  })

  const kernelAccount = await createKernelAccount(walletClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    useMetaFactory: false,
    entryPoint: entryPoint as any,
    kernelVersion,
  })

  walletClient.kernelAccount = kernelAccount as any
  walletClient.kernelAccountAddress = kernelAccount.address
  walletClient = walletClient.extend(KernelAccountActions).extend(publicActions) as any

  //conditionally deploys kernel account if it doesn't exist
  const args = await walletClient.deployKernelAccount()
  await addExecutorToKernelAccount(walletClient)
  return { client: walletClient, args }
}

async function addExecutorToKernelAccount<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7
>(client: KernelAccountClient<entryPointVersion>) {
  const multisigPublicAddress = client.account?.address!
  // Create the account object
  const account = getAccount({
    address: client.account?.address!,
    type: 'erc7579-implementation',
  })
  // const executor = getOwnableExecutor({
  //   owner: multisigPublicAddress,
  // })
  // const installReceipt = await installModule({
  //   client: client as any,
  //   account: account,
  //   module: executor
  // })

  // console.log('installReceipt: ', installReceipt)
  // await client.execute(installReceipt as any)
}
