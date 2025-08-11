/**
 * Stringify data with BigInt support
 * @param data the data to stringify
 * @returns
 */
export function jsonBigInt(data: any) {
  return JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
}
