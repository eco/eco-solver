import { Chain, getAddress, Hex } from 'viem'

/**
 * Gets the url for a chain with the given api key, either websocket or http. It tries
 * to find a non default rpc url if it exists and returns the first one it finds,
 * otherwise it returns the default one.
 *
 * @param chain the chain to get the url for
 * @param apiKeys the api key if it is required
 * @param websocketEnabled whether to try the websocket url if there is one
 * @returns
 */
export function getRpcUrl(
  chain: Chain,
  apiKeys: { alchemy: string; quicknode: string },
  websocketEnabled?: boolean,
): { url: string; isWebsocket: boolean } {
  let rpcUrl = chain.rpcUrls.default
  for (const key in chain.rpcUrls) {
    if (key === 'default') {
      continue
    }
    rpcUrl = chain.rpcUrls[key]
    break
  }

  websocketEnabled = websocketEnabled ?? getDefaultWebsocketFlag(chain)

  const isWebsocket = Boolean(websocketEnabled && rpcUrl.webSocket && rpcUrl.webSocket.length)

  let url = isWebsocket ? rpcUrl.webSocket![0] : rpcUrl.http[0]

  if (url.includes('g.alchemy.com')) {
    url += '/' + apiKeys.alchemy
  }

  // Replace placeholder text with QuickNode API Key
  url = url.replace('{QUICKNODE_API_KEY}', apiKeys.quicknode)

  return { url, isWebsocket }
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

function getDefaultWebsocketFlag(chain: Chain) {
  // WebSockets are enabled by default for QuickNode RPCs
  return chain.rpcUrls.default.http[0].includes('quicknode')
}
