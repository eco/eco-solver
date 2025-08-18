import { getAddress, Hex } from 'viem'

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
