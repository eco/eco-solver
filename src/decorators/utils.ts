/**
 * Serializes an object to JSON string, converting BigInt values to a special format
 * that can be safely stored and later deserialized back to BigInt.
 *
 * BigInt values are converted to objects with the format:
 * { __type: 'BigInt', value: 'string_representation' }
 *
 * @param obj - The object to serialize, can contain BigInt values at any nesting level
 * @returns JSON string with BigInt values converted to serializable format
 *
 * @example
 * const data = { balance: 1000n, nested: { amount: 500n } }
 * const serialized = serializeWithBigInt(data)
 * // Result: '{"balance":{"__type":"BigInt","value":"1000"},"nested":{"amount":{"__type":"BigInt","value":"500"}}}'
 */
export function serializeWithBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? { __type: 'BigInt', value: value.toString() } : value,
  )
}

/**
 * Deserializes a JSON string back to an object, converting specially formatted
 * BigInt objects back to native BigInt values.
 *
 * Objects with the format { __type: 'BigInt', value: 'string' } are converted
 * back to BigInt using the value property.
 *
 * @param serialized - JSON string containing serialized BigInt values
 * @returns Deserialized object with BigInt values restored to native BigInt type
 * @throws {TypeError} If the BigInt value string cannot be converted to BigInt
 * @throws {SyntaxError} If the JSON string is malformed
 *
 * @example
 * const serialized = '{"balance":{"__type":"BigInt","value":"1000"}}'
 * const obj = deserializeWithBigInt(serialized)
 * // Result: { balance: 1000n }
 */
export function deserializeWithBigInt(serialized: string): any {
  return JSON.parse(serialized, (_key, value) =>
    value && typeof value === 'object' && value.__type === 'BigInt' ? BigInt(value.value) : value,
  )
}
