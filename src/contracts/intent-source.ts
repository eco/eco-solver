import { ContractFunctionReturnType, decodeEventLog, Hex, Log, Prettify } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from 'alchemy-sdk'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'

// Define the type for the contract
export type IntentSource = typeof IntentSourceAbi

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentSourceViemType = Prettify<
  ContractFunctionReturnType<IntentSource, 'pure' | 'view', 'getIntent', [Hex]> & {
    hash: Hex
    logIndex: number
  }
>

// Define the type for the IntentCreated event log
export type IntentCreatedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IntentSourceAbi, 'IntentCreated'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>

export function decodeCreateIntentLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IntentSourceAbi,
    eventName: 'IntentCreated',
    topics,
    data,
  })
}
