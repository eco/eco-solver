import {
  WalletClient,
  Hex,
  Transport,
  Chain,
  Account,
  RpcSchema,
  Prettify,
  WalletRpcSchema,
  PublicActions,
} from 'viem'
import { DeployFactoryArgs } from './shared-types'

// The type that simple account executes arrays of
export type ExecuteSmartWalletArg = { to: Hex; data?: Hex; value?: bigint }

export type ExecuteSmartWalletArgs = ExecuteSmartWalletArg[]

export type SmartWalletActions = {
  execute: (args: ExecuteSmartWalletArgs) => Promise<Hex>
  deployKernelAccount: () => Promise<DeployFactoryArgs>
}

export type SmartWalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  WalletClient<
    transport,
    chain,
    account,
    rpcSchema extends RpcSchema ? [...WalletRpcSchema, ...rpcSchema] : WalletRpcSchema
  > &
    PublicActions<transport, chain> &
    SmartWalletActions
>
