export function sum<
  Item extends bigint | Record<string, unknown>,
  Key extends Item extends bigint ? never : keyof Item,
>(items: Item[], key?: Key): bigint {
  return items.reduce((sum, item) => {
    const amount = typeof item === 'bigint' ? item : (key ? ((item[key] ?? 0n) as bigint) : 0n);
    return sum + amount;
  }, 0n);
}

export function min(amounts: bigint[]) {
  return amounts.reduce((min, amount) => (min > amount ? amount : min), amounts[0]);
}

export function max(amounts: bigint[]) {
  return amounts.reduce((max, amount) => (max < amount ? amount : max), 0n);
}
