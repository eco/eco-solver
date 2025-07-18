export enum RhinestoneMessageType {
  Ping = 'Ping',
  Message = 'Message',
}

export interface BaseRhinestoneMessage {
  type: RhinestoneMessageType
}

export interface RhinestonePingMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.Ping
  timestamp?: number
}

export interface RhinestoneDataMessage extends BaseRhinestoneMessage {
  type: RhinestoneMessageType.Message
  data: unknown
  id?: string
}

export type RhinestoneMessage = RhinestonePingMessage | RhinestoneDataMessage

export const RHINESTONE_EVENTS = {
  CONNECTED: 'rhinestone.connected',
  DISCONNECTED: 'rhinestone.disconnected',
  ERROR: 'rhinestone.error',
  RECONNECT_FAILED: 'rhinestone.reconnect.failed',
  PING: 'rhinestone.ping',
  PONG: 'rhinestone.pong',
  MESSAGE_PING: 'rhinestone.message.Ping',
  MESSAGE_DATA: 'rhinestone.message.Message',
} as const

export type RhinestoneEventMap = {
  [RHINESTONE_EVENTS.CONNECTED]: void
  [RHINESTONE_EVENTS.DISCONNECTED]: { code: number; reason: string }
  [RHINESTONE_EVENTS.ERROR]: Error
  [RHINESTONE_EVENTS.RECONNECT_FAILED]: void
  [RHINESTONE_EVENTS.PING]: Buffer
  [RHINESTONE_EVENTS.PONG]: Buffer
  [RHINESTONE_EVENTS.MESSAGE_PING]: RhinestonePingMessage
  [RHINESTONE_EVENTS.MESSAGE_DATA]: RhinestoneDataMessage
}
