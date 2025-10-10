/**
 * Checks if a URL is a WebSocket URL.
 * @param url - The URL to check.
 * @returns True if the URL is a WebSocket URL, false otherwise.
 */
export function isWebsocket(url: string): boolean {
  return url.startsWith('ws://') || url.startsWith('wss://')
}
