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
