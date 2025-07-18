import { Address, Hex } from 'viem'

export const RHINESTONE_EVENTS = {
  CONNECTED: 'rhinestone.connected',
  DISCONNECTED: 'rhinestone.disconnected',
  ERROR: 'rhinestone.error',
  RECONNECT_FAILED: 'rhinestone.reconnect.failed',
  PING: 'rhinestone.ping',
  PONG: 'rhinestone.pong',
  MESSAGE_PING: 'rhinestone.message.Ping',
  MESSAGE_BUNDLE: 'rhinestone.message.RhinestoneBundle',
  RELAYER_ACTION_V1: 'rhinestone.message.RelayerActionV1',
} as const

export enum RhinestoneMessageType {
  Ping = 'Ping',
  RhinestoneBundle = 'RhinestoneBundle',
  RelayerActionV1 = 'RelayerActionV1',
}

export interface BaseRhinestoneMessage {
  type: RhinestoneMessageType
}

export interface RhinestonePingMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.Ping
  timestamp?: number
}

export type ChainExecution = {
  chainId: number
  to: Address
  value: bigint
  data: Hex
}

export interface RhinestoneBundleMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.RhinestoneBundle
  bundleId: string
  targetFillPayload: ChainExecution
  acrossDepositEvents: {
    originClaimPayload: ChainExecution
    inputToken: Address
    outputToken: Address
    inputAmount: string
    outputAmount: string
    destinationChainId: number
    depositId: string
    quoteTimestamp: number
    fillDeadline: string
    exclusivityDeadline: string
    depositor: Address
    recipient: Address
    exclusiveRelayer: Address
    message: Hex
  }[]
}

export type ChainCall = {
  chainId: number
  data: Hex
  to: Address
  value: string
}

export type ChainAction = {
  id: number
  settlementLayer: string
  call: ChainCall
}

export type FillAction = ChainAction

export type ClaimAction = ChainAction & {
  beforeFill: boolean
}

export interface RhinestoneRelayerActionV1 extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.RelayerActionV1
  id: string
  timestamp: number
  fill: FillAction
  claims: ClaimAction[]
}

export type RhinestoneMessage =
  | RhinestonePingMessage
  | RhinestoneBundleMessage
  | RhinestoneRelayerActionV1
