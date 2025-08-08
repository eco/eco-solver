import { findTokenDecimals } from '@/interceptors/utils'
import { normalizeBalance } from '@/fee/utils'
import { BASE_DECIMALS } from '@/intent/utils'
import { EcoError } from '@/common/errors/eco-error'

/**
 * Shared utility functions for normalizing token amounts across the application.
 * 
 * These utilities handle decimal transformations consistently between:
 * - Quote API interceptors (TokenDecimalsInterceptor)
 * - Watch event interceptors (WatchEventNormalizationInterceptor)
 */

/**
 * Interface for tokens that can be normalized
 */
export interface NormalizableToken {
  token: string
  amount: bigint | string
  decimals?: {
    original: number
    current: number
  }
}

/**
 * Normalizes token amounts in an array to BASE_DECIMALS (18) and adds decimal metadata.
 * 
 * @param tokens Array of tokens to normalize
 * @param chainId Chain ID to look up token decimals
 * @returns Array of normalized tokens with decimal metadata
 * @throws EcoError.UnknownTokenError if token decimals cannot be found
 */
export function normalizeTokenAmounts(tokens: NormalizableToken[], chainId: number): NormalizableToken[] {
  return tokens.map(token => {
    if (!token.token || !token.amount) return token

    const originalDecimals = findTokenDecimals(token.token, chainId)
    
    if (originalDecimals === null) {
      throw EcoError.UnknownTokenError(token.token, chainId)
    }

    const normalizedAmount = normalizeBalance(
      { balance: BigInt(token.amount), decimal: originalDecimals },
      BASE_DECIMALS
    ).balance

    return {
      ...token,
      amount: normalizedAmount,
      // Add decimal metadata to track transformations
      decimals: {
        original: originalDecimals,
        current: BASE_DECIMALS
      }
    }
  })
}

/**
 * Reverses token amount normalization from BASE_DECIMALS back to original decimals
 * using stored metadata, then removes the decimals field.
 * 
 * @param tokens Array of normalized tokens with decimal metadata
 */
export function denormalizeTokenAmounts(tokens: NormalizableToken[]): void {
  tokens.forEach((token) => {
    if (token.decimals) {
      // Reverse transform amount from current decimals back to original decimals using stored metadata
      if (token.amount) {
        token.amount = normalizeBalance(
          { balance: BigInt(token.amount), decimal: token.decimals.current },
          token.decimals.original,
        ).balance
      }

      // Remove the decimals field from the token
      delete token.decimals
    }
  })
}

/**
 * Reverses token amount normalization with explicit chain ID validation.
 * This validates that the token still exists in the chain configuration.
 * 
 * @param tokens Array of normalized tokens with decimal metadata
 * @param chainId Chain ID to validate token existence
 * @throws EcoError.UnknownTokenError if token no longer exists in chain config
 */
export function denormalizeTokenAmountsWithValidation(tokens: NormalizableToken[], chainId: number): void {
  tokens.forEach((token) => {
    if (token.decimals) {
      // Validate that token still exists in chains (in case chains config changed)
      const originalDecimals = findTokenDecimals(token.token, chainId)

      if (originalDecimals === null) {
        throw EcoError.UnknownTokenError(token.token, chainId)
      }

      // Reverse transform amount from current decimals back to original decimals
      if (token.amount) {
        token.amount = normalizeBalance(
          { balance: BigInt(token.amount), decimal: token.decimals.current },
          token.decimals.original,
        ).balance
      }

      // Remove decimals field from token
      delete token.decimals
    }
  })
}