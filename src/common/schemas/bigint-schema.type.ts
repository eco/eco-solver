import { Schema } from 'mongoose'

/**
 * Custom MongoDB schema type for BigInt values that handles proper serialization/deserialization
 * Stores BigInt as string in MongoDB and converts back to BigInt when retrieved
 * Also handles the case where BigInt values come with 'n' suffix
 */
export class BigIntSchemaType extends Schema.Types.String {
  constructor(key: string, options?: any) {
    super(key, {
      ...options,
      get: (value: string) => {
        if (!value) return value
        return BigInt(value)
      },
      set: (value: bigint | string | number) => {
        if (value === null || value === undefined) return value

        if (typeof value === 'string') {
          // Remove 'n' suffix if present and convert to BigInt, then back to string
          const cleanValue = value.endsWith('n') ? value.slice(0, -1) : value
          return BigInt(cleanValue).toString()
        }

        if (typeof value === 'number') {
          return BigInt(value).toString()
        }

        // Already a BigInt
        return value.toString()
      },
    })
  }
}
