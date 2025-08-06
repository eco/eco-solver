import { NormalizedTotal } from './types'
import { encodeFunctionData, erc20Abi, zeroAddress } from 'viem'

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

/**
 * Compares two normalized totals to see if the provided amount is insufficient to cover the needed amount.
 * @param ask the required normalized total
 * @param reward the available normalized total
 * @returns true if provided is insufficient (less than needed) for either token or native, false otherwise
 */
export function isInsufficient(ask: NormalizedTotal, reward: NormalizedTotal): boolean {
  return reward.token < ask.token || reward.native < ask.native
}

/**
 * Compares two normalized totals to see if the first is greater or equal to the second for both token and native values.
 * @param a the first normalized total
 * @param b the second normalized total
 * @returns true if a is greater than or equal to b for both token and native values, false otherwise
 */
export function isGreaterEqual(a: NormalizedTotal, b: NormalizedTotal): boolean {
  return a.token >= b.token && a.native >= b.native
}

export function formatNormalizedTotal(total: NormalizedTotal): string {
  return `Token: ${total.token.toString()} - Native: ${total.native}`
}

export function getTransferFromTokens(tokens: readonly { amount: bigint; token: `0x${string}` }[]) {
  return tokens.map((token) => ({
    target: token.token,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [zeroAddress, token.amount],
    }),
  }))
}
