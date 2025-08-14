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

function convertBigIntsToSerializable(obj: any): any {
  if (typeof obj === 'bigint') {
    // Handle negative bigints by storing sign separately
    const isNegative = obj < 0n
    const absValue = isNegative ? -obj : obj
    const hex = '0x' + absValue.toString(16)
    return { type: 'BigInt', hex: isNegative ? '-' + hex : hex } as SerializedBigInt
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntsToSerializable(item))
  }

  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigIntsToSerializable(value)
    }
    return result
  }

  return obj
}

function stringify(data: object | bigint) {
  const converted = convertBigIntsToSerializable(data)
  return JSON.stringify(converted)
}

export function deserialize<T extends object | string>(data: T): Deserialize<T> {
  // Handle different input types
  if (typeof data === 'string') {
    // If it's a string, try to parse as JSON, but if it fails, return the string as-is
    try {
      return JSON.parse(data, (_key, value) => {
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
    } catch {
      // If JSON parsing fails, return the string as-is
      return data as Deserialize<T>
    }
  }

  // If it's an object, check if it's a serialized BigInt
  if (isSerializedBigInt(data)) {
    // Handle negative bigints
    if (data.hex.startsWith('-')) {
      const positiveHex = data.hex.substring(1)
      return -BigInt(positiveHex) as Deserialize<T>
    }
    return BigInt(data.hex) as Deserialize<T>
  }

  // For other objects, recursively deserialize
  const result: any = Array.isArray(data) ? [] : {}
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      // Handle arrays specially
      result[key] = value.map((item) => {
        if (item && isSerializedBigInt(item)) {
          // Handle negative bigints
          if (item.hex.startsWith('-')) {
            const positiveHex = item.hex.substring(1)
            return -BigInt(positiveHex)
          }
          return BigInt(item.hex)
        } else if (typeof item === 'object' && item !== null) {
          return deserialize(item)
        }
        return item
      })
    } else if (value && isSerializedBigInt(value)) {
      // Handle negative bigints
      if (value.hex.startsWith('-')) {
        const positiveHex = value.hex.substring(1)
        result[key] = -BigInt(positiveHex)
      } else {
        result[key] = BigInt(value.hex)
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = deserialize(value)
    } else {
      result[key] = value
    }
  }

  return result as Deserialize<T>
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
