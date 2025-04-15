import { http, HttpTransport, webSocket, WebSocketTransport } from 'viem'

/**
 * Returns transport for the chain with the given api key
 *
 * @param rpcUrl RPC URL.
 * @param isWebsocket whether to use websocket or not, defaults to true
 * @returns the websocket or http transport
 */
export function getTransport(
  rpcUrl: string,
  isWebsocket: boolean = false,
): WebSocketTransport | HttpTransport {
  return isWebsocket ? webSocket(rpcUrl, { keepAlive: true, reconnect: true }) : http(rpcUrl)
}
