import { Transform } from 'class-transformer'
import { getAddress } from 'viem'

/**
 * Decorator that transforms dtos to chechsum addresses or throws
 */
export function ViemAddressTransform() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return getAddress(value) // validate and checksum
    }
    return value // Return as-is if not a string
  })
}
