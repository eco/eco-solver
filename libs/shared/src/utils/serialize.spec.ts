import { serialize, deserialize } from './serialize'

describe('Serialize BigInt', () => {
  it('serialize arrays correctly', () => {
    const obj = { array: [1, 2, 3] }
    const objDeserialized = deserialize(serialize(obj))

    expect(Array.isArray(objDeserialized.array)).toBeTruthy()
  })

  it('serialize bigint in array correctly', () => {
    const obj = { array: [1n, 2n, 3n] }
    const objDeserialized = deserialize(serialize(obj))

    expect(objDeserialized.array[0]).toBe(1n)
  })

  it('serialize bigint correctly', () => {
    const obj = { number: 1, bigInt: 1n }
    const objDeserialized = deserialize(serialize(obj))

    expect(typeof objDeserialized.bigInt).toBe('bigint')
  })

  it('deserialize bigint correctly', () => {
    const obj = {
      type: 'BigInt',
      hex: '0x5f57eac89ced72',
    }
    const objDeserialized = deserialize(obj)

    expect(objDeserialized).toBe(26836788687203698n)
  })

  it('deserialize string correctly', () => {
    const obj = 'test string'
    const objDeserialized = deserialize(obj)

    expect(objDeserialized).toBe(obj)
  })

  it('serialize nested objects with bigints and numbers correctly', () => {
    const obj = {
      level1: {
        number: 42,
        bigInt: 123456789n,
        level2: {
          anotherNumber: 3.14,
          anotherBigInt: 987654321n,
          level3: {
            deepNumber: 100,
            deepBigInt: 999999999999999999n,
          },
        },
      },
      topLevelNumber: 7,
      topLevelBigInt: 555n,
    }

    const serialized = serialize(obj)
    const deserialized = deserialize(serialized)

    expect(deserialized.level1.number).toBe(42)
    expect(deserialized.level1.bigInt).toBe(123456789n)
    expect(typeof deserialized.level1.bigInt).toBe('bigint')
    expect(deserialized.level1.level2.anotherNumber).toBe(3.14)
    expect(deserialized.level1.level2.anotherBigInt).toBe(987654321n)
    expect(typeof deserialized.level1.level2.anotherBigInt).toBe('bigint')
    expect(deserialized.level1.level2.level3.deepNumber).toBe(100)
    expect(deserialized.level1.level2.level3.deepBigInt).toBe(999999999999999999n)
    expect(typeof deserialized.level1.level2.level3.deepBigInt).toBe('bigint')
    expect(deserialized.topLevelNumber).toBe(7)
    expect(deserialized.topLevelBigInt).toBe(555n)
    expect(typeof deserialized.topLevelBigInt).toBe('bigint')
  })

  it('serialize arrays with nested objects containing bigints and numbers', () => {
    const obj = {
      items: [
        { id: 1, value: 100n, price: 99.99 },
        { id: 2, value: 200n, price: 149.99 },
        { id: 3, value: 300n, price: 199.99 },
      ],
      totals: {
        count: 3,
        sum: 600n,
        average: 150.5,
      },
    }

    const serialized = serialize(obj)
    const deserialized = deserialize(serialized)

    expect(Array.isArray(deserialized.items)).toBeTruthy()
    expect(deserialized.items[0].id).toBe(1)
    expect(deserialized.items[0].value).toBe(100n)
    expect(typeof deserialized.items[0].value).toBe('bigint')
    expect(deserialized.items[0].price).toBe(99.99)
    expect(deserialized.items[1].value).toBe(200n)
    expect(deserialized.items[2].value).toBe(300n)
    expect(deserialized.totals.count).toBe(3)
    expect(deserialized.totals.sum).toBe(600n)
    expect(typeof deserialized.totals.sum).toBe('bigint')
    expect(deserialized.totals.average).toBe(150.5)
  })

  it('serialize mixed arrays with bigints, numbers, and nested objects', () => {
    const obj = {
      mixedArray: [
        1,
        2n,
        3.14,
        { nested: 4, bigIntValue: 5n },
        [6, 7n, { deep: 8, deepBigInt: 9n }],
        10n,
      ],
    } as const

    const serialized = serialize(obj)
    const deserialized = deserialize(serialized)

    expect(deserialized.mixedArray[0]).toBe(1)
    expect(deserialized.mixedArray[1]).toBe(2n)
    expect(typeof deserialized.mixedArray[1]).toBe('bigint')
    expect(deserialized.mixedArray[2]).toBe(3.14)
    expect(deserialized.mixedArray[3].nested).toBe(4)
    expect(deserialized.mixedArray[3].bigIntValue).toBe(5n)
    expect(typeof deserialized.mixedArray[3].bigIntValue).toBe('bigint')
    expect(deserialized.mixedArray[4][0]).toBe(6)
    expect(deserialized.mixedArray[4][1]).toBe(7n)
    expect(typeof deserialized.mixedArray[4][1]).toBe('bigint')
    expect(deserialized.mixedArray[4][2].deep).toBe(8)
    expect(deserialized.mixedArray[4][2].deepBigInt).toBe(9n)
    expect(typeof deserialized.mixedArray[4][2].deepBigInt).toBe('bigint')
    expect(deserialized.mixedArray[5]).toBe(10n)
    expect(typeof deserialized.mixedArray[5]).toBe('bigint')
  })

  it('serialize deeply nested structures with bigints and numbers', () => {
    const obj = {
      a: {
        b: {
          c: {
            d: {
              e: {
                number: 42,
                bigInt: 123456789012345678901234567890n,
                array: [1, 2n, 3, 4n],
                nested: {
                  value: 99.99,
                  bigValue: 888888888888888888n,
                },
              },
            },
          },
        },
      },
    }

    const serialized = serialize(obj)
    const deserialized = deserialize(serialized)

    expect(deserialized.a.b.c.d.e.number).toBe(42)
    expect(deserialized.a.b.c.d.e.bigInt).toBe(123456789012345678901234567890n)
    expect(typeof deserialized.a.b.c.d.e.bigInt).toBe('bigint')
    expect(deserialized.a.b.c.d.e.array[0]).toBe(1)
    expect(deserialized.a.b.c.d.e.array[1]).toBe(2n)
    expect(typeof deserialized.a.b.c.d.e.array[1]).toBe('bigint')
    expect(deserialized.a.b.c.d.e.array[2]).toBe(3)
    expect(deserialized.a.b.c.d.e.array[3]).toBe(4n)
    expect(typeof deserialized.a.b.c.d.e.array[3]).toBe('bigint')
    expect(deserialized.a.b.c.d.e.nested.value).toBe(99.99)
    expect(deserialized.a.b.c.d.e.nested.bigValue).toBe(888888888888888888n)
    expect(typeof deserialized.a.b.c.d.e.nested.bigValue).toBe('bigint')
  })

  it('handle edge cases with zero and negative bigints in nested structures', () => {
    const obj = {
      zeros: {
        normalZero: 0,
        bigIntZero: 0n,
        negativeNumber: -42,
        negativeBigInt: -123456789n,
      },
      nested: {
        array: [0, 0n, -1, -1n],
        deep: {
          zero: 0n,
          negative: -999999999999999999n,
        },
      },
    }

    const serialized = serialize(obj)
    const deserialized = deserialize(serialized)

    expect(deserialized.zeros.normalZero).toBe(0)
    expect(deserialized.zeros.bigIntZero).toBe(0n)
    expect(typeof deserialized.zeros.bigIntZero).toBe('bigint')
    expect(deserialized.zeros.negativeNumber).toBe(-42)
    expect(deserialized.zeros.negativeBigInt).toBe(-123456789n)
    expect(typeof deserialized.zeros.negativeBigInt).toBe('bigint')
    expect(deserialized.nested.array[0]).toBe(0)
    expect(deserialized.nested.array[1]).toBe(0n)
    expect(typeof deserialized.nested.array[1]).toBe('bigint')
    expect(deserialized.nested.array[2]).toBe(-1)
    expect(deserialized.nested.array[3]).toBe(-1n)
    expect(typeof deserialized.nested.array[3]).toBe('bigint')
    expect(deserialized.nested.deep.zero).toBe(0n)
    expect(deserialized.nested.deep.negative).toBe(-999999999999999999n)
  })
})
