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
      return { type: 'BigInt', hex: '0x' + value.toString(16) } as SerializedBigInt
    }
    return value
  })
}

export function deserialize<T extends object>(data: T): Deserialize<T> {
  return JSON.parse(JSON.stringify(data), (_key, value) =>
    value && isSerializedBigInt(value) ? BigInt(value.hex) : value,
  )
}

export function serialize<T extends object | bigint>(data: T): Serialize<T> {
  return JSON.parse(stringify(data))
}
