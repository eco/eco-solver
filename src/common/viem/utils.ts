import { Chain, getAddress, Hex } from 'viem'
import { EcoConfigType } from '@/eco-configs/eco-config.types'
import { TransportOptions } from '@/common/chains/transport'

/**
 * Generates the RPC URL for a given blockchain network and configuration options.
 *
 * @param {Chain} chain - The blockchain network details, including RPC URLs.
 * @param {Object} options - Configuration options for generating the RPC URL.
 * @param {string} options.alchemy - The Alchemy API key for connecting to Alchemy services.
 * @param {string[]} [options.rpcUrls] - A list of custom RPC URLs to override the default settings.
 * @param {boolean} [options.websocketEnabled] - Indicates whether a WebSocket URL should be returned.
 *
 * @return {Object} An object containing the connection URL and a flag indicating if it's a WebSocket URL.
 * @return {string} return.url - The generated RPC URL.
 * @return {boolean} return.isWebsocket - A flag indicating whether the returned URL is a WebSocket URL.
 */
export function getRpcUrl(
  chain: Chain,
  options: {
    alchemyApiKey: string
    rpcUrls?: EcoConfigType['rpcUrls'][string]
    websocketEnabled?: boolean
  },
): { url: string; transportOptions: TransportOptions } {
  const { alchemyApiKey, rpcUrls: customRpcUrls, websocketEnabled } = options

  let rpcUrls = chain.rpcUrls.default
  for (const key in chain.rpcUrls) {
    if (key === 'default') continue
    rpcUrls = chain.rpcUrls[key]
    break
  }

  rpcUrls = customRpcUrls?.http
    ? { http: customRpcUrls.http, webSocket: customRpcUrls.webSocket }
    : rpcUrls

  const isWebsocket = Boolean((websocketEnabled ?? customRpcUrls) && rpcUrls.webSocket?.length)

  let url = isWebsocket ? rpcUrls.webSocket![0] : rpcUrls.http[0]

  if (!customRpcUrls && url.includes('g.alchemy.com')) {
    url += '/' + alchemyApiKey
  }

  const transportOptions: TransportOptions = {
    isWebsocket: isWebsocket,
    options: customRpcUrls?.options,
  }

  return { url, transportOptions }
}

/**
 * Lowercase all top-level keys of the given `object` to lowercase.
 *
 * @returns {Object}
 */
export function addressKeys(obj: Record<Hex, any>): Record<Hex, any> {
  return Object.entries(obj).reduce((carry, [key, value]) => {
    carry[getAddress(key)] = value
    return carry
  }, {})
}

/**
 * Recursively converts all BigInt values in an object to strings.
 *
 * @param {Object} obj - The object to process.
 * @returns {Object} - The new object with BigInt values as strings.
 */
export function convertBigIntsToStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToStrings)
  }

  if (typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (carry, [key, value]) => {
        carry[key] = convertBigIntsToStrings(value)
        return carry
      },
      {} as Record<string, any>,
    )
  }

  return obj
}

/**
 *  Checks if the data is empty. It checks if the data is '0x' or if it has only 0 characters.
 * @param data the data to check
 * @returns
 */
export function isEmptyData(data: Hex) {
  return (
    data === '0x' ||
    // has only 0 characters
    /^0+$/.test(data.split('0x')[1])
  )
}
