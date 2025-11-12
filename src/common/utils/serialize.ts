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

function isSerializedBigInt(x: any): x is SerializedBigInt {
  return x && x.type === 'BigInt' && typeof x.hex === 'string'
}

/** Pre-walk to convert bigints to { type:'BigInt', hex } (handles arrays & objects). */
function toSerializable(value: any): any {
  if (typeof value === 'bigint') {
    const isNeg = value < 0n
    const abs = isNeg ? -value : value
    const hex = '0x' + abs.toString(16)
    return { type: 'BigInt', hex: isNeg ? '-' + hex : hex } as SerializedBigInt
  }
  if (Array.isArray(value)) return value.map(toSerializable)
  if (value && typeof value === 'object') {
    // keep plain JSON semantics for non-JSON values (functions/undefined drop later)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toSerializable(v)]))
  }
  return value
}

function stringify(data: object | bigint) {
  return JSON.stringify(toSerializable(data))
}

export function serialize<T extends object | bigint>(data: T): Serialize<T> {
  return JSON.parse(stringify(data))
}

/** Revive by JSON round-trip (keeps your existing API) */
export function deserialize<T extends object | string>(data: T): Deserialize<T> {
  return JSON.parse(JSON.stringify(data), (_k, v) => {
    if (isSerializedBigInt(v)) {
      return v.hex.startsWith('-') ? -BigInt(v.hex.slice(1)) : BigInt(v.hex)
    }
    return v
  })
}
