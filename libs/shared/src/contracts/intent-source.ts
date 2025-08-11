import { 
  Hex, 
  Log, 
  Prettify,
  DecodeEventLogReturnType,
  decodeEventLog
} from 'viem'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'

// TODO: These types should be defined locally or imported from a proper shared location
// For now, we'll keep the interfaces defined in this file
// import { CallDataType, RewardTokensType } from '..'

// Temporary type definitions until we have proper imports
type CallDataType = any
type RewardTokensType = any
type Network = any

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentCreatedEventViemType = {
  hash: Hex
  logIndex: number
  args: any // TODO: Type this properly when GetEventArgs equivalent is available
}
/**
 * Define the interface for the calls field in the IntentSource event
 */
export type CallDataInterface = CallDataType

/**
 * Define the interface for the token amount field in the IntentSource event
 */
export type RewardTokensInterface = RewardTokensType

/**
 * Define the type for the IntentSource event log
 */
export type IntentCreatedEventLog = DecodeEventLogReturnType<
  typeof IntentSourceAbi,
  'IntentCreated'
>

// Define the type for the IntentCreated event log
export type IntentCreatedLog = Log & {
  sourceNetwork: Network
  sourceChainID: bigint
  args: any // TODO: Type this properly when ExtractAbiEvent equivalent is available
}

export function decodeCreateIntentLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IntentSourceAbi,
    eventName: 'IntentCreated',
    topics,
    data,
  })
}

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentFundedEventViemType = {
  hash: Hex
  logIndex: number
  args: any // TODO: Type this properly when GetEventArgs equivalent is available
}

/**
 * Define the type for the IntentSource event log
 */
export type IntentFundedEventLog = DecodeEventLogReturnType<typeof IntentSourceAbi, 'IntentFunded'>

// Define the type for the IntentCreated event log
export type IntentFundedLog = Log & {
  sourceNetwork: Network
  sourceChainID: bigint
  args: any // TODO: Type this properly when ExtractAbiEvent equivalent is available
}

export function decodeIntentFundedLog(data: Hex, topics: [signature: Hex, ...args: Hex[]] | []) {
  return decodeEventLog({
    abi: IntentSourceAbi,
    eventName: 'IntentFunded',
    topics,
    data,
  })
}
