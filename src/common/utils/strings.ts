import { Hex } from 'viem'
import { IntentJobServiceName, WatchJobServiceName } from '@/intent/utils'

export function getRandomString() {
  return Math.random().toString(36).slice(2)
}

export function getDestinationNetworkAddressKey(
  chainID: number | bigint,
  tokenAddress: string,
): string {
  return `${chainID}-${tokenAddress}`
}

/**
 * Appends the service name to the intent hash for the job id, else it will be the same for all intents
 * as they progress down the processing pipe and interfere in the queue
 *
 * @param intentHash the hash of the intent to fulfill
 * @param logIndex the transaction index of the intent to fulfill. Necessary if multiple intents are in the same transaction
 * @returns
 */
export function getIntentJobId(
  serviceName: IntentJobServiceName,
  intentHash: Hex | undefined,
  logIndex: number = 0,
): string {
  return getJobId(serviceName, intentHash, logIndex)
}

/**
 * Generates a unique job ID for watch service events by combining the service name,
 * event identifier (hash), and log index. This ensures each watch event gets a unique
 * job ID in the processing queue to prevent collisions and duplicate processing.
 *
 * Used by watch services (e.g., watch-tokens, watch-native, watch-create-intent) to
 * create identifiable job IDs for blockchain events they monitor.
 *
 * @param serviceName - The name of the watch service (e.g., 'watch-tokens', 'watch-native')
 * @param intentHash - The transaction hash or intent hash from the blockchain event
 * @param logIndex - The log index within the transaction (defaults to 0 for native transfers)
 * @returns A unique job ID string in format: "serviceName-hash-logIndex"
 *
 * @example
 * // For ERC20 token transfer event
 * getWatchJobId('watch-tokens', '0x1234...', 2)
 * // Returns: "watch-tokens-0x1234...-2"
 *
 * @example
 * // For native token transfer (no log index)
 * getWatchJobId('watch-native', '0x5678...', 0)
 * // Returns: "watch-native-0x5678...-0"
 */
export function getWatchJobId(
  serviceName: WatchJobServiceName,
  intentHash: Hex | undefined,
  logIndex: number = 0,
): string {
  return getJobId(serviceName, intentHash, logIndex)
}

/**
 * Internal helper function that creates a standardized job ID format used by both
 * intent processing and watch service job ID generators.
 *
 * @param serviceName - The service name (intent service or watch service)
 * @param intentHash - The blockchain event hash (transaction hash or intent hash)
 * @param logIndex - The log index within the transaction
 * @returns A formatted job ID string: "serviceName-hash-logIndex"
 * @private
 */
function getJobId(serviceName: string, intentHash: Hex | undefined, logIndex: number = 0): string {
  return `${serviceName}-${intentHash}-${logIndex}`
}

/**
 * Obscures the center of a string, leaving a number of characters visible at the start and end
 * @param str the string to obscure
 * @param visibleChars number of characters at the start and end of the string to leave visible
 * @returns
 */
export function obscureCenter(str: string, visibleChars: number = 2): string {
  if (visibleChars <= 0) {
    return str
  }
  if (str.length <= visibleChars * 2) {
    return '*'.repeat(str.length) // If string is too short, obscure all characters
  }

  const start = str.slice(0, visibleChars)
  const end = str.slice(-visibleChars)
  const middle = '*'.repeat(str.length - visibleChars * 2)

  return `${start}${middle}${end}`
}
