import { Transform } from 'class-transformer'
import { getAddress, Hex } from 'viem'

/**
 * Decorator that transforms dtos to chechsum addresses or throws
 */
export function ToViemAddress() {
  return Transform(({ value }) => getAddress(value) as Hex)
}
