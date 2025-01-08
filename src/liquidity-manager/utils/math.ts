export function getSlippageRange(amount: bigint, slippage: number) {
  const slippageFactor = BigInt(Math.round(slippage * 100000))
  const base = 100000n

  const min = (amount * (base - slippageFactor)) / base
  const max = (amount * (base + slippageFactor)) / base

  return { min, max }
}
