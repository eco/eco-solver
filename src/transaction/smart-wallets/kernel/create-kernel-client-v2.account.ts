import {
  KernelVersion,
  ToEcdsaKernelSmartAccountParameters,
  ToEcdsaKernelSmartAccountReturnType,
} from 'permissionless/accounts'
import {
  Account,
  Chain,
  Client,
  ClientConfig,
  createPublicClient,
  LocalAccount,
  OneOf,
  Prettify,
  RpcSchema,
  Transport,
  WalletClient,
} from 'viem'
import { entryPoint07Address, SmartAccount } from 'viem/account-abstraction'
import { entryPointV_0_7 } from '@/transaction/smart-wallets/kernel/create.kernel.account'
import { EthereumProvider } from 'permissionless/utils/toOwner'
import {
  createKernelAccount,
  createKernelAccountClient,
  CreateKernelAccountReturnType,
  KernelAccountClient,
} from '@zerodev/sdk'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator'
import { KernelAccountClientConfig } from '@/transaction/smart-wallets/kernel/kernel-account.config'

export type KernelAccountClientV2Config<
  entryPointVersion extends '0.6' | '0.7',
  kernelVersion extends KernelVersion<entryPointVersion>,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  >,
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined =
    | ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    | undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  ClientConfig<transport, chain, account, rpcSchema> &
    ToEcdsaKernelSmartAccountParameters<entryPointVersion, kernelVersion, owner> & {
      ownerAccount: Account
    }
>

export async function createKernelAccountClientV2<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  > = LocalAccount,
>(
  parameters: KernelAccountClientConfig<entryPointVersion, KernelVersion<entryPointVersion>, owner>,
): Promise<KernelAccountClient<Transport, Chain, SmartAccount, Client>> {
  const { key = 'kernelAccountClient', name = 'Kernel Account Client' } = parameters
  const { account } = parameters

  const publicClient = createPublicClient({
    ...parameters,
    key,
    name,
  })

  const kernelVersion = KERNEL_V3_1
  const entryPoint = {
    address: entryPoint07Address,
    version: '0.7',
  } as const

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: account as LocalAccount,
    entryPoint,
    kernelVersion,
  })

  const kernelAccount: CreateKernelAccountReturnType = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    useMetaFactory: false,
    entryPoint,
    kernelVersion,
  })

  return createKernelAccountClient({
    account: kernelAccount,
    client: publicClient,
    bundlerTransport: parameters.transport,
    chain: parameters.chain,
  }) as KernelAccountClient<Transport, Chain, SmartAccount, Client>
}
