import {
  HttpTransportConfig,
  WebSocketTransportConfig,
} from 'viem'

export type TransportConfig =
  | { isWebsocket: true; config?: WebSocketTransportConfig }
  | { isWebsocket?: false; config?: HttpTransportConfig }