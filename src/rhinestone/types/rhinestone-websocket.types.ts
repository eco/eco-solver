import { Address, Hex } from 'viem'

/**
 * Event names for Rhinestone WebSocket events
 */
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

/**
 * Types of messages that can be received from Rhinestone WebSocket
 */
export enum RhinestoneMessageType {
  Ping = 'Ping',
  RhinestoneBundle = 'RhinestoneBundle',
  RelayerActionV1 = 'RelayerActionV1',
}

/**
 * Base interface for all Rhinestone messages
 */
export interface BaseRhinestoneMessage {
  type: RhinestoneMessageType
}

/**
 * Ping message for keeping WebSocket connection alive
 */
export interface RhinestonePingMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.Ping
  timestamp?: number
}

/**
 * Chain-specific execution details for cross-chain operations
 */
export type ChainExecution = {
  chainId: number
  to: Address
  value: string
  data: Hex
}

/**
 * Bundle message containing deposit events and fill payload
 */
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

/**
 * Details for a call to be executed on a specific chain
 */
export type ChainCall = {
  chainId: number
  data: Hex
  to: Address
  value: string
}

/**
 * Base type for chain actions (fills and claims)
 */
export type ChainAction = {
  id: number
  settlementLayer?: string
  call: ChainCall
}

/**
 * Fill action containing execution details
 */
export type FillAction = ChainAction

/**
 * Claim action with beforeFill flag indicating execution order
 */
export type ClaimAction = ChainAction & {
  beforeFill: boolean
}

/**
 * Relayer action message containing fills and claims to execute
 */
export interface RhinestoneRelayerActionV1 extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.RelayerActionV1
  id: string
  timestamp: number
  fill: FillAction
  claims: ClaimAction[]
}

/**
 * Union type of all possible Rhinestone messages
 */
export type RhinestoneMessage =
  | RhinestonePingMessage
  | RhinestoneBundleMessage
  | RhinestoneRelayerActionV1
