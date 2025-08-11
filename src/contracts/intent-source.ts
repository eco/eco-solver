import { decodeEventLog, DecodeEventLogReturnType, GetEventArgs, Hex, Log, Prettify, decodeAbiParameters } from 'viem'
import { ExtractAbiEvent } from 'abitype'
import { Network } from '@/common/alchemy/network'
import { IntentSourceAbi, decodeRoute } from '@eco-foundation/routes-ts'
import { CallDataType, RewardTokensType } from '@/quote/dto/types'
import { deserialize } from '@/common/utils/serialize'

// Define RouteStruct since it's not exported from @eco-foundation/routes-ts
const RouteStruct = [
  {
    internalType: "bytes32",
    name: "salt", 
    type: "bytes32"
  },
  {
    internalType: "uint64",
    name: "deadline",
    type: "uint64"
  },
  {
    internalType: "address", 
    name: "portal",
    type: "address"
  },
  {
    components: [
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "uint256", 
        name: "amount",
        type: "uint256"
      }
    ],
    internalType: "struct TokenAmount[]",
    name: "tokens",
    type: "tuple[]"
  },
  {
    components: [
      {
        internalType: "address",
        name: "target", 
        type: "address"
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes"
      },
      {
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    internalType: "struct Call[]",
    name: "calls", 
    type: "tuple[]"
  }
]

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
  const decodedRoute = decodeAbiParameters(
    [{ type: 'tuple', components: RouteStruct }],
    `0x${routeBuffer.toString('hex')}` as `0x${string}`, 
  )[0]
  
  return {
    args: {
      hash: `0x${Buffer.from(log.data.intent_hash[0]).toString('hex')}` as `0x${string}`,
      salt: decodedRoute.salt as `0x${string}`,
      source: 1399811150n, // legacy field
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
