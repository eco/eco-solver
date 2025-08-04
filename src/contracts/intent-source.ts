import { decodeEventLog, DecodeEventLogReturnType, GetEventArgs, Hex, Log, Prettify, decodeAbiParameters } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from '@/common/alchemy/network'
import { IntentSourceAbi, decodeRoute, VmType } from '@eco-foundation/routes-ts'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'
import { deserialize } from '@/common/utils/serialize'

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

// Helper function to create intent log structure for Solana
export function decodeSolanaIntentLogForCreateIntent(log: any) {
  
  const routeBuffer = Buffer.from(log.data.route.data);
  // decoding the EVM ABI-encoded route struct using decodeRoute from eco-foundation/routes-ts
  const decodedRoute = decodeRoute(VmType.EVM, `0x${routeBuffer.toString('hex')}`);
  
  return {
    args: {
      hash: `0x${Buffer.from(log.data.intent_hash[0]).toString('hex')}` as `0x${string}`,
      salt: decodedRoute.salt as `0x${string}`,
      source: 1399811150n, // legacy field
      destination: log.data.destination as bigint,
      inbox: decodedRoute.portal as `0x${string}`,
      routeTokens: decodedRoute.tokens as readonly { token: `0x${string}`; amount: bigint }[],
      calls: decodedRoute.calls as readonly { target: `0x${string}`; data: `0x${string}`; value: bigint }[],
      creator: log.data.reward.creator as `0x${string}`, // base58 encoded TODO fix later
      prover: log.data.reward.prover as `0x${string}`, // base58 encoded TODO fix later
      deadline: BigInt(`0x${log.data.reward.deadline}`),
      nativeValue: BigInt(`0x${log.data.reward.native_amount}`),
      rewardTokens: log.data.reward.tokens, // Proper type
    },
    eventName: 'IntentCreated' as const,
  };
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
