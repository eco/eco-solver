import {
  ContractFunctionArgs,
  DecodeEventLogReturnType,
  getAbiItem,
  GetEventArgs,
  Hex,
  Log,
  Prettify,
} from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from '@/common/alchemy/network'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'
import { portalAbi } from '@/contracts/v2-abi/Portal'

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentCreatedEventViemType = Prettify<
  GetEventArgs<
    typeof portalAbi,
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
export type IntentCreatedEventLog = DecodeEventLogReturnType<typeof portalAbi, 'IntentPublished'>

// Define the type for the IntentCreated event log
export type IntentCreatedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof portalAbi, 'IntentPublished'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>

// Define the type for the IntentSource struct in the contract, and add the hash and logIndex fields
export type IntentFundedEventViemType = Prettify<
  GetEventArgs<
    typeof portalAbi,
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
export type IntentFundedEventLog = DecodeEventLogReturnType<typeof portalAbi, 'IntentFunded'>

export type V2IntentType = ContractFunctionArgs<typeof portalAbi, 'pure', 'getIntentHash'>[number]
export type V2RouteType = Extract<V2IntentType, { route: any }>['route']

export const intentStructAbiItem = getAbiItem({
  abi: portalAbi,
  name: 'isIntentFunded',
}).inputs[0]

export const [, routeStructAbiItem, rewardStructAbiItem] = intentStructAbiItem.components

// Define the type for the IntentCreated event log
export type IntentFundedLog = Prettify<
  Log<bigint, number, false, ExtractAbiEvent<typeof portalAbi, 'IntentFunded'>, true> & {
    sourceNetwork: Network
    sourceChainID: bigint
  }
>
