import * as _ from 'lodash'

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
  if (typeof data !== 'object') return data

  const deserialized: any = _.cloneDeep(data)

  if (isSerializedBigInt(data)) {
    return BigInt(data.hex) as T
  }

  for (const key in data) {
    const item = data[key]
    if (isSerializedBigInt(item)) {
      deserialized[key] = BigInt(item.hex)
    } else if (item && typeof item === 'object') {
      deserialized[key] = deserialize(item)
    } else {
      deserialized[key] = item
    }
  }

  return deserialized
}

export function serialize<T extends object>(data: T): Serialize<T> {
  return JSON.parse(stringify(data))
}
