import { deserialize, serialize } from './serialize'

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
})
