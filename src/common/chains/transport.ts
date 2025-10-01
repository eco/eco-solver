import { isWebsocket } from '@/common/chains/utils'
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

export type TransportConfig = WebSocketTransportConfig | HttpTransportConfig | undefined

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
    if (isWebsocket(url)) {
      return webSocket(url, { keepAlive: true, reconnect: true, ...config })
    }
    return http(url, config)
  })

  return transports.length > 1 ? fallback(transports, { rank: false }) : transports[0]
}
