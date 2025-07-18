import { Hex } from 'viem'

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

export interface RhinestoneBundleMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.RhinestoneBundle
  bundleId: string
  targetFillPayload: {
    chainId: number
    data: Hex
    to: Hex
    value: string
  }
  acrossDepositEvents: [
    {
      originClaimPayload: {
        chainId: number
        data: Hex
        to: Hex
        value: string
      }
      inputToken: Hex
      outputToken: Hex
      inputAmount: string
      outputAmount: string
      destinationChainId: number
      depositId: string
      quoteTimestamp: number
      fillDeadline: string
      exclusivityDeadline: string
      depositor: Hex
      recipient: Hex
      exclusiveRelayer: Hex
      message: Hex
    },
  ]
}

export interface RhinestoneRelayerActionV1 extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.RelayerActionV1
  id: string
  timestamp: number
  fill: {
    id: number
    settlementLayer: string
    call: {
      chainId: number
      to: Hex
      value: string
      data: Hex
    }
    tokens: []
  }
  claims: {
    id: number
    settlementLayer: string
    call: {
      chainId: number
      to: Hex
      value: string
      data: Hex
    }
    tokens: []
    beforeFill: false
  }[]
}

export type RhinestoneMessage =
  | RhinestonePingMessage
  | RhinestoneBundleMessage
  | RhinestoneRelayerActionV1
