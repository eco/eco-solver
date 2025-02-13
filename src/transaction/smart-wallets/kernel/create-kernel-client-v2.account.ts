import { SmartAccountActions, SmartAccountClient } from 'permissionless'
import {
  KernelVersion,
  toEcdsaKernelSmartAccount,
  ToEcdsaKernelSmartAccountParameters,
  ToEcdsaKernelSmartAccountReturnType,
} from 'permissionless/accounts'
import {
  Account,
  Chain,
  Client,
  ClientConfig,
  createClient,
  createWalletClient,
  Hash,
  LocalAccount,
  OneOf,
  Prettify,
  RpcSchema,
  SendTransactionParameters,
  SendTransactionRequest,
  Transport,
  WalletClient,
} from 'viem'
import { SendUserOperationParameters } from 'viem/account-abstraction'
import { encodeKernelExecuteCallData } from '@/transaction/smart-wallets/kernel/actions/encodeData.kernel'
import { entryPointV_0_7 } from '@/transaction/smart-wallets/kernel/create.kernel.account'
import { sendTransaction } from 'viem/actions'
import { EthereumProvider } from 'permissionless/utils/toOwner'

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

export type KernelAccountClientV2<
  entryPointVersion extends '0.6' | '0.7',
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined =
    | ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    | undefined,
  client extends Client | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  SmartAccountClient<transport, chain, account, client, rpcSchema> & {
    ownerAccount: Account
  }
>

export async function createKernelAccountClientV2<
  entryPointVersion extends '0.6' | '0.7' = entryPointV_0_7,
  owner extends OneOf<
    EthereumProvider | WalletClient<Transport, Chain | undefined, Account> | LocalAccount
  > = LocalAccount,
>(
  _parameters: KernelAccountClientV2Config<
    entryPointVersion,
    KernelVersion<entryPointVersion>,
    owner
  >,
): Promise<KernelAccountClientV2<entryPointVersion>> {
  const { ownerAccount, ...parameters } = _parameters

  const { key = 'kernelAccountClientV2', name = 'Kernel Account Client V2', transport } = parameters
  const { account } = parameters

  const walletClient = createWalletClient({
    ...parameters,
    account,
    key,
    name,
    transport,
  })

  const kernelAccount = await toEcdsaKernelSmartAccount<
    entryPointVersion,
    KernelVersion<entryPointVersion>,
    owner
  >({
    ...parameters,
    client: walletClient,
  })

  const client = Object.assign(
    createClient({
      ...parameters,
      account: kernelAccount,
      chain: parameters.chain ?? walletClient?.chain,
    }),
    { ownerAccount },
  )

  return client.extend(kernelAccountV2Actions) as KernelAccountClientV2<entryPointVersion>
}

function kernelAccountV2Actions<
  entryPointVersion extends '0.6' | '0.7',
  TChain extends Chain | undefined = Chain | undefined,
  account extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined =
    | ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    | undefined,
>(
  client: KernelAccountClientV2<entryPointVersion, Transport, TChain, account>,
): Pick<SmartAccountActions<TChain, account>, 'sendTransaction'> {
  return {
    sendTransaction: (args) => sendTransactionWithSWC(client, args as any),
  }
}

async function sendTransactionWithSWC<
  entryPointVersion extends '0.6' | '0.7',
  account extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined =
    | ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    | undefined,
  chain extends Chain | undefined = Chain | undefined,
  accountOverride extends ToEcdsaKernelSmartAccountReturnType<entryPointVersion> | undefined =
    | ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    | undefined,
  chainOverride extends Chain | undefined = Chain | undefined,
  calls extends readonly unknown[] = readonly unknown[],
  const request extends SendTransactionRequest<chain, chainOverride> = SendTransactionRequest<
    chain,
    chainOverride
  >,
>(
  client: KernelAccountClientV2<entryPointVersion, Transport, chain, account>,
  args:
    | SendTransactionParameters<chain, account, chainOverride>
    | SendUserOperationParameters<account, accountOverride, calls>,
): Promise<Hash> {
  const account = (args.account as Account) ?? client.account
  if (account?.type !== 'smart') {
    if (!('to' in args)) throw new Error('Unsupported args')
    return sendTransaction(client, args as any)
  }

  let calls: calls
  let request: request

  if ('to' in args) {
    const { data, maxFeePerGas, maxPriorityFeePerGas, to, value } =
      args as SendTransactionParameters<chain, account, chainOverride>

    calls = [{ to, data, value }] as unknown as calls
    request = { maxFeePerGas, maxPriorityFeePerGas } as request
  } else if ('calls' in args) {
    calls = args.calls as unknown as calls
    request = {} as request
  } else {
    throw new Error('Unsupported action in Kernel Client V2')
  }

  if (!client.account) {
    throw new Error('Account not defined in Kernel Client V2')
  }

  const txs = calls.map((tx: any) => ({ to: tx.to, data: tx.data, value: tx.value }))
  const kernelVersion = client.account.entryPoint.version == '0.6' ? '0.2.4' : '0.3.1'
  const data = encodeKernelExecuteCallData({ calls: txs, kernelVersion })
  return sendTransaction(client, {
    ...(request as any),
    data: data,
    kzg: undefined,
    to: client.account.address,
    chain: client.chain,
    account: client.ownerAccount,
  })
}
