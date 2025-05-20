import { NormalizedTotal } from './types'

type BalanceObject = {
  balance: bigint
  decimal: number
}

/**
 * Normalizes the balance to a new decimal precision.
 */
export function normalizeBalance(value: BalanceObject, targetDecimal: number): BalanceObject {
  if (!Number.isInteger(value.decimal) || !Number.isInteger(targetDecimal)) {
    throw new Error('Decimal values must be integers')
  }
  const scaleFactor = BigInt(10 ** Math.abs(targetDecimal - value.decimal))

  let newBalance: bigint
  if (targetDecimal > value.decimal) {
    newBalance = value.balance * scaleFactor // Scale up
  } else {
    newBalance = value.balance / scaleFactor // Scale down
  }

  return { balance: newBalance, decimal: targetDecimal }
}

/**
 *  Normalizes the sum of two normalized totals.
 * @param a the first normalized total
 * @param b the second normalized total
 * @returns
 */
export function normalizeSum(a: NormalizedTotal, b: NormalizedTotal): NormalizedTotal {
  return {
    token: a.token + b.token,
    native: a.native + b.native,
  }
}
