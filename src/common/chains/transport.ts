import {
  http,
  HttpTransport,
  HttpTransportConfig,
  webSocket,
  WebSocketTransport,
  WebSocketTransportConfig,
  FallbackTransport,
  fallback,
} from 'viem'

export type TransportConfig =
  | { isWebsocketEnabled: true; config?: WebSocketTransportConfig }
  | { isWebsocketEnabled: false; config?: HttpTransportConfig }

/**
 * Returns a transport for the chain with the given rpc urls
 *
 * @param rpcUrls RPC URLs.
 * @param config Transport configuration.
 * @returns the websocket or http transport or a fallback transport if there are multiple rpc urls
 */
export function getTransport(
  rpcUrls: string[],
  config?: TransportConfig,
): WebSocketTransport | HttpTransport | FallbackTransport {
  const transports: (WebSocketTransport | HttpTransport)[] = rpcUrls.map((url) => {
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return webSocket(url, { keepAlive: true, reconnect: true, ...config?.config })
    }
    return http(url, config?.config)
  })

  return transports.length > 1 ? fallback(transports, { rank: true }) : transports[0]
}
