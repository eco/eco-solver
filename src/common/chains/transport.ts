import {
  http,
  HttpTransport,
  HttpTransportConfig,
  webSocket,
  WebSocketTransport,
  WebSocketTransportConfig,
} from 'viem'

export type TransportConfig =
  | { isWebsocket: true; config?: WebSocketTransportConfig }
  | { isWebsocket?: false; config?: HttpTransportConfig }

/**
 * Returns transport for the chain with the given api key
 *
 * @param rpcUrl RPC URL.
 * @param config
 * @returns the websocket or http transport
 */
export function getTransport(
  rpcUrl: string,
  config?: TransportConfig,
): WebSocketTransport | HttpTransport {
  return config?.isWebsocket
    ? webSocket(rpcUrl, { keepAlive: true, reconnect: true, ...config?.config })
    : http(rpcUrl, config?.config)
}
