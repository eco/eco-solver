import {
  Account,
  Chain,
  Hex,
  Prettify,
  publicActions,
  RpcSchema,
  Transport,
  WalletRpcSchema,
} from 'viem'
import { ExecuteSmartWalletArgs, SmartWalletClient } from '../smart-wallet.types'
import { ToEcdsaKernelSmartAccountReturnType } from 'permissionless/accounts'
import { KernelWalletActions } from './kernel-account.config'
import { encodeKernelExecuteCallData } from './actions/encodeData.kernel'

export type DeployFactoryArgs = {
  factory?: Hex | undefined
  factoryData?: Hex | undefined
  deployReceipt?: Hex | undefined
  chainID?: number
}

export type KernelAccountClient<
  entryPointVersion extends '0.6' | '0.7',
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  SmartWalletClient<
    transport,
    chain,
    account,
    rpcSchema extends RpcSchema ? [...WalletRpcSchema, ...rpcSchema] : WalletRpcSchema
  > & {
    kernelAccount: ToEcdsaKernelSmartAccountReturnType<entryPointVersion>
    kernelAccountAddress: Hex
  }
>

export function KernelAccountActions<
  entryPointVersion extends '0.6' | '0.7',
  transport extends Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
>(client: KernelAccountClient<entryPointVersion, transport, chain, account>): KernelWalletActions {
  return {
    execute: (args) => execute(client, args),
    deployKernelAccount: () => deployKernelAccount(client),
  }
}

async function execute<
  entryPointVersion extends '0.6' | '0.7',
  chain extends Chain | undefined,
  account extends Account | undefined,
>(
  client: KernelAccountClient<entryPointVersion, Transport, chain, account>,
  transactions: ExecuteSmartWalletArgs,
): Promise<Hex> {
  const calls = transactions.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value }))
  const kernelVersion = client.kernelAccount.entryPoint.version == '0.6' ? '0.2.4' : '0.3.1'
  const data = encodeKernelExecuteCallData({ calls, kernelVersion })
  return client.sendTransaction({
    data: data,
    kzg: undefined,
    to: client.kernelAccount.address,
    chain: client.chain as Chain,
    account: client.account as Account,
  })
}

async function deployKernelAccount<
  entryPointVersion extends '0.6' | '0.7',
  transport extends Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
>(
  client: KernelAccountClient<entryPointVersion, transport, chain, account>,
): Promise<DeployFactoryArgs> {
  const args: DeployFactoryArgs = {}

  const publicClient = client.extend(publicActions)

  const code = await publicClient.getCode({ address: client.kernelAccount.address })

  if (!code) {
    const fa = await client.kernelAccount.getFactoryArgs()
    args.factory = fa.factory
    args.factoryData = fa.factoryData
    args.chainID = client.chain?.id
    args.deployReceipt = await client.sendTransaction({
      data: args.factoryData,
      kzg: undefined,
      to: args.factory,
      chain: client.chain as Chain,
      account: client.account as Account,
    })
    await client.waitForTransactionReceipt({ hash: args.deployReceipt, confirmations: 5 })
  }
  return args
}
