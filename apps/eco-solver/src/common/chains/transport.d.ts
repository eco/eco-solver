import { HttpTransport, HttpTransportConfig, WebSocketTransport, WebSocketTransportConfig, FallbackTransport } from 'viem';
export type TransportConfig = {
    isWebsocket: true;
    config?: WebSocketTransportConfig;
} | {
    isWebsocket?: false;
    config?: HttpTransportConfig;
};
/**
 * Returns a transport for the chain with the given rpc urls
 *
 * @param rpcUrls RPC URLs.
 * @param config Transport configuration.
 * @returns the websocket or http transport or a fallback transport if there are multiple rpc urls
 */
export declare function getTransport(rpcUrls: string[], config?: TransportConfig): WebSocketTransport | HttpTransport | FallbackTransport;
