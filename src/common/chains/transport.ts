import {
  http,
  HttpTransport,
  HttpTransportConfig,
  webSocket,
  WebSocketTransport,
  WebSocketTransportConfig,
} from 'viem'

export type TransportOptions =
  | { isWebsocket: true; options?: WebSocketTransportConfig }
  | { isWebsocket?: false; options?: HttpTransportConfig }

/**
 * Returns transport for the chain with the given api key
 *
 * @param rpcUrl RPC URL.
 * @param options
 * @returns the websocket or http transport
 */
export function getTransport(
  rpcUrl: string,
  options?: TransportOptions,
): WebSocketTransport | HttpTransport {
  return options?.isWebsocket
    ? webSocket(rpcUrl, { keepAlive: true, reconnect: true, ...options?.options })
    : http(rpcUrl, options?.options)
}
