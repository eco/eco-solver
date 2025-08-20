import { keccak256, toBytes } from "viem"
import { Hex } from "viem"

/**
 * Deterministically serializes an object into a JSON string
 */
export function serializeObject(obj: object): string {
  return JSON.stringify(obj, Object.keys(obj).sort())
}

/**
 * Hashes an object using keccak256
 */
export function hashObject(obj: object): Hex {
  const json = serializeObject(obj)
  const hash = keccak256(toBytes(json))
  return hash
}

/**
 * Lowercase all top-level keys of the given `object` to lowercase.
 *
 * @returns {Object}
 */
export function lowercaseKeys(obj: Record<string, any>): Record<string, any> | undefined {
  if (!obj) {
    return undefined
  }

  return Object.entries(obj).reduce((carry, [key, value]) => {
    carry[key.toLowerCase()] = value

    return carry
  }, {})
}
