export type Serialize<T> = T extends bigint
  ? { type: 'BigInt'; hex: string }
  : {
      [K in keyof T]: T[K] extends bigint
        ? { type: 'BigInt'; hex: string }
        : T[K] extends object
          ? Serialize<T[K]>
          : T[K]
    }

type SerializedBigInt = { type: 'BigInt'; hex: string }

function isSerializedBigInt(data: any): data is SerializedBigInt {
  return data && data.type === 'BigInt' && typeof data.hex === 'string'
}

function stringify(data: object) {
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'bigint') {
      return { type: 'BigInt', hex: '0x' + value.toString(16) } as SerializedBigInt
    }
    return value
  })
}

export function deserialize<T extends object | bigint>(data: Serialize<T>): T {
  return JSON.parse(JSON.stringify(data), (_key, value) =>
    value && isSerializedBigInt(value) ? BigInt(value.hex) : value,
  )
}

export function serialize<T extends object>(data: T): Serialize<T> {
  return JSON.parse(stringify(data))
}
