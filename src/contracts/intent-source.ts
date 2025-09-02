import { decodeEventLog, DecodeEventLogReturnType, GetEventArgs, Hex, Log, Prettify, decodeAbiParameters } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from '@/common/alchemy/network'
import { IIntentSourceAbi } from '@/utils/IIntentSource'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'
import { RouteStruct } from '@/intent/abi'
import { decodeRoute } from '@/utils/encodeAndHash'
import { VmType } from '@/eco-configs/eco-config.types'

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
  const decoded = decodeEventLog({
    abi: IIntentSourceAbi,
    eventName: 'IntentPublished',
    topics,
    data,
  })
  
  // Convert new IntentPublished format to old IntentCreated format
  const converted = convertIntentPublishedToCreated(decoded.args);
  
  return {
    ...decoded,
    args: converted,
    eventName: 'IntentCreated' as const
  };
}

// Helper function to create intent log structure for Solana
// Helper function to convert new IntentPublished event to old IntentCreated format
export function convertIntentPublishedToCreated(event: any) {
  const decodedRoute = decodeRoute(VmType.SVM, event.route as Hex);
  console.log("MADDEN: decodedRoute", decodedRoute)
  
  return {
    hash: event.intentHash,
    salt: decodedRoute.salt,
    source: 10n, // legacy field
    destination: event.destination,
    inbox: decodedRoute.portal,
    routeTokens: decodedRoute.tokens,
    calls: decodedRoute.calls,
    creator: event.creator,
    prover: event.prover,
    deadline: event.rewardDeadline,
    nativeValue: event.rewardNativeAmount,
    rewardTokens: event.rewardTokens
  };
}

export function decodeSolanaIntentLogForCreateIntent(log: any) {
  
  const routeBuffer = Buffer.from(log.data.route.data);
  const decodedRoute = decodeAbiParameters(
    [{ type: 'tuple', components: RouteStruct }],
    `0x${routeBuffer.toString('hex')}` as `0x${string}`, 
  )[0]
  
  return {
    args: {
      hash: `0x${Buffer.from(log.data.intent_hash[0]).toString('hex')}` as `0x${string}`,
      salt: decodedRoute.salt as `0x${string}`,
      source: 1399811149n, // legacy field
      destination: BigInt(`0x${log.data.destination}`),
      inbox: decodedRoute.portal as `0x${string}`,
      routeTokens: decodedRoute.tokens as readonly { token: `0x${string}`; amount: bigint }[],
      calls: decodedRoute.calls as readonly { target: `0x${string}`; data: `0x${string}`; value: bigint }[],
      creator: log.data.reward.creator as `0x${string}`, // base58 encoded TODO fix later
      prover: log.data.reward.prover as `0x${string}`, // base58 encoded TODO fix later
      deadline: BigInt(`0x${log.data.reward.deadline}`),
      nativeValue: BigInt(`0x${log.data.reward.native_amount}`),
      rewardTokens: log.data.reward.tokens.map((token: any) => ({
        token: token.token as `0x${string}`,
        amount: BigInt(`0x${token.amount}`)
      })),
    },
    eventName: 'IntentCreated' as const,
  };
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
