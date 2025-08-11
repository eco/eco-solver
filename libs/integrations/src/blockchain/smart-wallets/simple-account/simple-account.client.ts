import {   encodeFunctionData,
  Hex,
  Transport,
  Chain,
  Account,
  RpcSchema,
  Prettify,
  WalletRpcSchema,
} from 'viem'
import {   ExecuteSmartWalletArgs,
  SmartWalletActions,
  SmartWalletClient,
} from '@libs/integrations/smart-wallet.types'

export type SimpleAccountClient<
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
    simpleAccountAddress: Hex
  }
>

export function SimpleAccountActions<
  transport extends Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
>(
  client: SimpleAccountClient<transport, chain, account>,
): Omit<SmartWalletActions, 'deployKernelAccount'> {
  return {
    execute: (args) => execute(client, args),
  }
}

async function execute<chain extends Chain | undefined, account extends Account | undefined>(
  client: SimpleAccountClient<Transport, chain, account>,
  transactions: ExecuteSmartWalletArgs,
): Promise<Hex> {
  if (transactions.length === 1) {
    const [tx] = transactions

    const data = encodeFunctionData({
      abi: SimpleAccountAbi,
      functionName: 'execute',
      args: [tx.to, tx.value || 0n, tx.data!],
    })

    return client.sendTransaction({
      data: data,
      kzg: undefined,
      to: client.simpleAccountAddress,
      chain: client.chain as Chain,
      account: client.account as Account,
    })
  }
  throwIfValueSendInBatch(transactions)

  const data = encodeFunctionData({
    abi: SimpleAccountAbi,
    functionName: 'executeBatch',
    args: [transactions.map((tx) => tx.to), transactions.map((tx) => tx.data!)],
  })

  return client.sendTransaction({
    data: data,
    kzg: undefined,
    to: client.simpleAccountAddress,
    chain: client.chain as Chain,
    account: client.account as Account,
  })
}
