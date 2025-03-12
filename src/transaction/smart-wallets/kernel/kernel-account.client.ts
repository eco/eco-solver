// // import {
// //   Account,
// //   Chain,
// //   Client,
// //   createPublicClient,
// //   Hex,
// //   http,
// //   Prettify,
// //   RpcSchema,
// //   Transport,
// //   WalletRpcSchema,
// // } from 'viem'
// // import { ExecuteSmartWalletArgs, SmartWalletClient } from '../smart-wallet.types'
// // import { ToEcdsaKernelSmartAccountReturnType } from 'permissionless/accounts'
// // import { KernelWalletActions } from './kernel-account.config'
// // import { encodeKernelExecuteCallData } from './actions/encodeData.kernel'
// // import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
// // import { KernelAccountClientActions } from '@zerodev/sdk'
// // import { SmartAccount } from 'viem/account-abstraction/accounts/types'

import { KernelWalletActions } from '@/transaction/smart-wallets/kernel'
import { encodeKernelExecuteCallData } from '@/transaction/smart-wallets/kernel/actions/encodeData.kernel'
import { KernelAccountClientWithoutBundler } from '@/transaction/smart-wallets/kernel/create.kernel.account'
import { ExecuteSmartWalletArgs } from '@/transaction/smart-wallets/smart-wallet.types'
import { KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { Account, Chain, Hex, Transport } from 'viem'
import { SmartAccount } from 'viem/_types/account-abstraction'

// import { KernelWalletActions } from "@/transaction/smart-wallets/kernel"
// import { KernelAccountClientWithoutBundler } from "@/transaction/smart-wallets/kernel/create.kernel.account"
// import { ExecuteSmartWalletArgs } from "@/transaction/smart-wallets/smart-wallet.types"
// import { Chain, Hex, Transport } from "viem"
// import { SmartAccount } from "viem/_types/account-abstraction"

export type DeployFactoryArgs = {
  factory?: Hex | undefined
  factoryData?: Hex | undefined
  deployReceipt?: Hex | undefined
  chainID?: number
}

// // export type KernelAccountClient<
// //   transport extends Transport = Transport,
// //   chain extends Chain | undefined = Chain | undefined,
// //   account extends SmartAccount | undefined = SmartAccount | undefined,
// //   client extends Client | undefined = Client | undefined,
// //   rpcSchema extends RpcSchema | undefined = undefined
// // > = Prettify<
// //   Client<
// //     transport,
// //     chain extends Chain
// //     ? chain
// //     : // biome-ignore lint/suspicious/noExplicitAny: <explanation>
// //     client extends Client<any, infer chain>
// //     ? chain
// //     : undefined,
// //     account,
// //     rpcSchema,
// //     KernelAccountClientActions<chain, account>
// //   >
// // >

export function KernelAccountActions<
  transport extends Transport,
  chain extends Chain,
  account extends SmartAccount,
>(client: KernelAccountClientWithoutBundler<transport, chain, account>): KernelWalletActions {
  return {
    execute: (args) => execute(client, args),
    deployKernelAccount: () => deployKernelAccount(client),
  }
}

async function execute<chain extends Chain, account extends SmartAccount>(
  client: KernelAccountClientWithoutBundler<Transport, chain, account>,
  transactions: ExecuteSmartWalletArgs,
): Promise<Hex> {
  const calls = transactions.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value }))
  const data = encodeKernelExecuteCallData({ calls, kernelVersion: '0.3.1' })
  return client.sendTransaction({
    data: data,
    kzg: undefined,
    to: client.account.address,
    chain: client.chain as Chain,
    account: client.account as Account,
  })
}

async function deployKernelAccount<
  transport extends Transport,
  chain extends Chain,
  account extends SmartAccount,
>(
  client: KernelAccountClientWithoutBundler<transport, chain, account>,
): Promise<Hex> {
  if (! (await client.account.isDeployed())) {
   return await client.sendTransaction({
      data: '0x',
      kzg: undefined,
      to: client.account.address,
      chain: client.chain as Chain,
      account: client.account as Account,
    })
  }
  return client.account.address
}
