import { Hex } from 'viem'
import { normalizeBalance } from '@/fee/utils'
import { NormalizedToken } from '@/fee/types'

export const BASE_DECIMALS = 6

/**
 * Converts and normalizes a token value to a standard decimal representation
 * @param value The bigint amount to convert
 * @param token An object containing the chainID, address, and decimals of the token
 * @returns A NormalizedToken with the balance normalized to BASE_DECIMALS
 */
export function convertNormalize(
  value: bigint,
  token: { chainID: bigint; address: Hex; decimals: number },
): NormalizedToken {
  const original = value
  const newDecimals = BASE_DECIMALS
  //todo some conversion, assuming here 1-1
  return {
    ...token,
    balance: normalizeBalance({ balance: original, decimal: token.decimals }, newDecimals).balance,
    decimals: newDecimals,
  }
}

/**
 * Deconverts a normalized token value back to its original decimal representation
 * @param value The normalized bigint amount
 * @param token An object containing the chainID, address, and decimals of the token
 * @returns The deconverted bigint value
 */
export function deconvertNormalize(
  value: bigint,
  token: { chainID: bigint; address: Hex; decimals: number },
): bigint {
  return normalizeBalance({ balance: value, decimal: BASE_DECIMALS }, token.decimals).balance
}
