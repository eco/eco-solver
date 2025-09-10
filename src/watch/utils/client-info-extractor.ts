import { PublicClient } from 'viem'

/**
 * Extracts chain ID from a PublicClient
 * @param client The PublicClient instance
 * @returns The chain ID or 'unknown' if not available
 */
export function extractChainId(client: PublicClient): number | 'unknown' {
  return client.chain?.id ?? 'unknown'
}

/**
 * Sanitizes RPC URL by removing sensitive information like API keys
 * @param url The RPC URL to sanitize
 * @returns Sanitized URL with sensitive data masked
 */
export function sanitizeRpcUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // Remove API keys from query parameters
    const sanitizedParams = new URLSearchParams()
    for (const [key, value] of urlObj.searchParams) {
      // Common API key parameter names to mask
      if (
        ['apikey', 'api_key', 'key', 'token', 'auth'].some((param) =>
          key.toLowerCase().includes(param),
        )
      ) {
        sanitizedParams.set(key, '***')
      } else {
        sanitizedParams.set(key, value)
      }
    }

    // Replace API keys in path (e.g., /v1/{api_key}/...)
    let sanitizedPath = urlObj.pathname
    // Match common patterns like /v1/abc123def/, /api/abc123def, etc.
    // Look for segments that look like API keys (alphanumeric strings 6+ chars)
    sanitizedPath = sanitizedPath.replace(
      /\/[0-9a-fA-F]{6,}|\/[a-zA-Z0-9_-]{8,}|\/key[0-9a-fA-F]+/gi,
      '/***',
    )

    // Reconstruct URL
    const sanitizedUrl = new URL(urlObj.origin + sanitizedPath)
    sanitizedUrl.search = sanitizedParams.toString()

    return sanitizedUrl.toString()
  } catch (error) {
    // If URL parsing fails, just mask the entire thing after the protocol
    const protocolMatch = url.match(/^(https?|wss?):\/\//)
    if (protocolMatch) {
      return `${protocolMatch[1]}://***`
    }
    return '***'
  }
}

/**
 * Attempts to extract RPC URL from a PublicClient's transport
 * @param client The PublicClient instance
 * @returns Sanitized RPC URL or 'unknown' if not extractable
 */
export function extractSanitizedRpcUrl(client: PublicClient): string {
  try {
    // Access transport configuration
    const transport = client.transport

    // Different transport types store URL differently
    if (transport && typeof transport === 'object') {
      let rawUrl: string | undefined

      // Check for direct url property (HTTP transport)
      if ('url' in transport && typeof transport.url === 'string') {
        rawUrl = transport.url
      }
      // WebSocket transport
      else if (
        'socket' in transport &&
        transport.socket &&
        'url' in transport.socket &&
        typeof transport.socket.url === 'string'
      ) {
        rawUrl = transport.socket.url
      }
      // Fallback transport (array of URLs)
      else if ('transports' in transport && Array.isArray(transport.transports)) {
        const firstTransport = transport.transports[0]
        if (firstTransport && 'url' in firstTransport && typeof firstTransport.url === 'string') {
          rawUrl = firstTransport.url
        }
      }

      if (rawUrl) {
        return sanitizeRpcUrl(rawUrl)
      }
    }

    return 'unknown'
  } catch (error) {
    return 'unknown'
  }
}

/**
 * Extracts comprehensive client information for logging
 * @param client The PublicClient instance
 * @returns Object containing chainId and sanitized RPC URL
 */
export interface ClientInfo {
  chainId: number | 'unknown'
  rpcUrl: string
}

export function extractClientInfo(client: PublicClient): ClientInfo {
  return {
    chainId: extractChainId(client),
    rpcUrl: extractSanitizedRpcUrl(client),
  }
}
