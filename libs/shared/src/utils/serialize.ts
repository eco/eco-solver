type SerializedBigInt = { type: 'BigInt'; hex: string }

export type Serialize<T> = T extends bigint
  ? SerializedBigInt
  : {
      [K in keyof T]: T[K] extends bigint
        ? SerializedBigInt
        : T[K] extends object
          ? Serialize<T[K]>
          : T[K]
    }

export type Deserialize<T> = T extends SerializedBigInt
  ? bigint
  : T extends object
    ? {
        [K in keyof T]: T[K] extends SerializedBigInt
          ? bigint
          : T[K] extends object
            ? Deserialize<T[K]>
            : T[K]
      }
    : T

function isSerializedBigInt(data: any): data is SerializedBigInt {
  return data && data.type === 'BigInt' && typeof data.hex === 'string'
}

function stringify(data: object | bigint) {
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') {
      // Handle negative bigints by storing sign separately
      const isNegative = value < 0n
      const absValue = isNegative ? -value : value
      const hex = '0x' + absValue.toString(16)
      return { type: 'BigInt', hex: isNegative ? '-' + hex : hex } as SerializedBigInt
    }
    return value
  })
}

export function deserialize<T extends object | string>(data: T): Deserialize<T> {
  return JSON.parse(JSON.stringify(data), (_key, value) => {
    if (value && isSerializedBigInt(value)) {
      // Handle negative bigints
      if (value.hex.startsWith('-')) {
        const positiveHex = value.hex.substring(1)
        return -BigInt(positiveHex)
      }
      return BigInt(value.hex)
    }
    return value
  })
}

export function serialize<T extends object | bigint>(data: T): Serialize<T> {
  return JSON.parse(stringify(data))
}

// Wrapper functions for backward compatibility and better naming
export function serializeWithBigInt<T extends object | bigint>(data: T): string {
  return stringify(data)
}

export function deserializeWithBigInt<T extends object | string>(data: T): Deserialize<T> {
  if (typeof data === 'string') {
    return deserialize(data)
  }
  return data as Deserialize<T>
}
