const BASE_DECIMALS = 18;

export function normalize(amount: bigint, decimals: number): bigint {
  return amount * 10n ** BigInt(BASE_DECIMALS - decimals);
}

export function denormalize(amount: bigint, decimals: number): bigint {
  return amount / 10n ** BigInt(BASE_DECIMALS - decimals);
}
