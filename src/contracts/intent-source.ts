import {
  ContractFunctionArgs,
  decodeEventLog,
  DecodeEventLogReturnType,
  GetEventArgs,
  Hex,
  Log,
  Prettify,
} from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from '@/common/alchemy/network'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'
import { IIntentSourceAbi } from 'v2-abi/IIntentSource'

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentCreatedEventViemType = Prettify<
  GetEventArgs<
    typeof IIntentSourceAbi,
    'IntentPublished',
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
  typeof IIntentSourceAbi,
  'IntentPublished'
>

// Define the type for the IntentCreated event log
export type IntentCreatedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IIntentSourceAbi, 'IntentPublished'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>

export function decodeCreateIntentLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IIntentSourceAbi,
    eventName: 'IntentPublished',
    topics,
    data,
  })
}

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentFundedEventViemType = Prettify<
  GetEventArgs<
    typeof IIntentSourceAbi,
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
export type IntentFundedEventLog = DecodeEventLogReturnType<typeof IIntentSourceAbi, 'IntentFunded'>

export type V2IntentType = ContractFunctionArgs<
  typeof IIntentSourceAbi,
  'pure',
  'getIntentHash'
>[number]
export type V2RouteType = Extract<V2IntentType, { route: any }>['route']

export const routeStructAbi = [
  { name: 'salt', type: 'bytes32' },
  { name: 'deadline', type: 'uint64' },
  { name: 'portal', type: 'address' },
  { name: 'nativeAmount', type: 'uint256' },
  {
    name: 'tokens',
    type: 'tuple[]',
    components: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'calls',
    type: 'tuple[]',
    components: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
    ],
  },
] as const

// Define the type for the IntentCreated event log
export type IntentFundedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof IIntentSourceAbi, 'IntentFunded'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>

export function decodeIntentFundedLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IIntentSourceAbi,
    eventName: 'IntentFunded',
    topics,
    data,
  })
}
