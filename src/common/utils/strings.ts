import { Hex } from 'viem'

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
  serviceName: string,
  intentHash: Hex | undefined,
  logIndex: number = 0,
): string {
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
