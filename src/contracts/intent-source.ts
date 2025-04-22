import { decodeEventLog, DecodeEventLogReturnType, GetEventArgs, Hex, Log, Prettify } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from 'alchemy-sdk'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentCreatedEventViemType = Prettify<
  GetEventArgs<
    typeof IntentSourceAbi,
    'IntentCreated',
    {
      EnableUnion: true
      IndexedOnly: false
      Required: false
    }
  > & {
    hash: Hex
    logIndex: number
  }
>
/**
 * Define the interface for the calls field in the IntentSource event
 */
export interface CallDataInterface extends CallDataType {}

/**
 * Define the interface for the token amount field in the IntentSource event
 */
export interface RewardTokensInterface extends RewardTokensType {}

/**
 * Define the type for the IntentSource event log
 */
export type IntentCreatedEventLog = DecodeEventLogReturnType<
  typeof IntentSourceAbi,
  'IntentCreated'
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

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentFundedEventViemType = Prettify<
  GetEventArgs<
    typeof IntentSourceAbi,
    'IntentFunded',
    {
      EnableUnion: true
      IndexedOnly: false
      Required: false
    }
  > & {
    hash: Hex
    logIndex: number
  }
>

/**
 * Define the type for the IntentSource event log
 */
export type IntentFundedEventLog = DecodeEventLogReturnType<typeof IntentSourceAbi, 'IntentFunded'>

// Define the type for the IntentCreated event log
export type IntentFundedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IntentSourceAbi, 'IntentFunded'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>

export function decodeIntentFundedLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IntentSourceAbi,
    eventName: 'IntentFunded',
    topics,
    data,
  })
}
