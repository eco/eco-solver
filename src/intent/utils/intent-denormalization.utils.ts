import { TokenAmountDataModel } from '@/intent/schemas/intent-token-amount.schema'
import { normalizeBalance } from '@/fee/utils'
import { findTokenDecimals } from '@/interceptors/utils'
import { BASE_DECIMALS } from '../utils'

/**
 * Creates a denormalized copy of tokens with amounts converted back to original decimals.
 * Uses findTokenDecimals to look up the original decimal configuration.
 *
 * @param tokens Array of tokens (assumed to be in BASE_DECIMALS format)
 * @param chainId Chain ID to look up token decimals
 * @returns Array of tokens with amounts in original decimals
 */
export function denormalizeTokenAmounts(
  tokens: TokenAmountDataModel[],
  chainId: number,
): TokenAmountDataModel[] {
  if (!tokens || !Array.isArray(tokens)) {
    return []
  }

  return tokens.map((token) => {
    if (!token || !token.token || token.amount === undefined || token.amount === null) {
      throw new Error(`Invalid token data: ${JSON.stringify(token)}`)
    }

    const originalDecimals = findTokenDecimals(token.token, chainId)

    if (originalDecimals === null || originalDecimals === BASE_DECIMALS) {
      // If token not found or already in correct decimals, return as-is
      return {
        token: token.token,
        amount: token.amount,
      }
    }

    // Convert amount from BASE_DECIMALS back to original decimals
    const denormalizedBalance = normalizeBalance(
      { balance: BigInt(token.amount), decimal: BASE_DECIMALS },
      originalDecimals,
    ).balance

    return {
      token: token.token,
      amount: denormalizedBalance,
    }
  })
}
