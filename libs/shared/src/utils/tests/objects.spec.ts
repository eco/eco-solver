describe('serializeObject', () => {
  it('should serialize an object with sorted keys', () => {
    const obj = { b: 2, a: 1 }
    const expected = '{"a":1,"b":2}'
    expect(serializeObject(obj)).toBe(expected)
  })

  it('should handle an empty object', () => {
    expect(serializeObject({})).toBe('{}')
  })
})

describe('hashObject', () => {
  it('should return a keccak256 hash of the serialized object', () => {
    const obj = { foo: 'bar', num: 42 }
    const json = serializeObject(obj)
    const expectedHash = keccak256(toBytes(json))
    expect(hashObject(obj)).toBe(expectedHash)
  })
})
