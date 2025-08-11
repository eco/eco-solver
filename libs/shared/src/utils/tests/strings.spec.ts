describe('obscureCenter', () => {
  it('should obscure the center of a string with default visible characters', () => {
    expect(obscureCenter('hello world')).toBe('he*******ld')
  })

  it('should obscure the center with a custom number of visible characters', () => {
    expect(obscureCenter('typescript', 3)).toBe('typ****ipt')
  })

  it('should return a string of asterisks if the input length is less than or equal to twice the visibleChars', () => {
    expect(obscureCenter('test', 2)).toBe('****')
    expect(obscureCenter('hi', 1)).toBe('**')
    expect(obscureCenter('abcdef', 3)).toBe('******')
  })

  it('should return the same string if the visible chars is negative or 0', () => {
    expect(obscureCenter('abcdef', -1)).toBe('abcdef')
    expect(obscureCenter('abcdef', 0)).toBe('abcdef')
  })
})

describe('hasDuplicateStrings', () => {
  it('should return false for an empty array', () => {
    expect(hasDuplicateStrings([])).toBe(false)
  })

  it('should return false for an array with one element', () => {
    expect(hasDuplicateStrings(['test'])).toBe(false)
  })

  it('should return false for an array with unique strings', () => {
    expect(hasDuplicateStrings(['apple', 'banana', 'cherry'])).toBe(false)
    expect(hasDuplicateStrings(['a', 'b', 'c', 'd', 'e'])).toBe(false)
  })

  it('should return true for an array with duplicate strings', () => {
    expect(hasDuplicateStrings(['apple', 'banana', 'apple'])).toBe(true)
    expect(hasDuplicateStrings(['test', 'test'])).toBe(true)
  })

  it('should return true for multiple duplicates', () => {
    expect(hasDuplicateStrings(['a', 'b', 'c', 'a', 'b'])).toBe(true)
  })

  it('should handle case sensitivity correctly', () => {
    expect(hasDuplicateStrings(['Apple', 'apple'])).toBe(false)
    expect(hasDuplicateStrings(['TEST', 'test'])).toBe(false)
  })

  it('should return true as soon as first duplicate is found', () => {
    expect(hasDuplicateStrings(['1', '2', '3', '2', '4', '5', '3'])).toBe(true)
  })

  it('should handle hex addresses correctly', () => {
    expect(
      hasDuplicateStrings([
        '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
        '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29',
      ]),
    ).toBe(false)
    expect(
      hasDuplicateStrings([
        '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
        '0x9D6AC51b972544251Fcc0F2902e633E3f9BD3f29',
        '0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc',
      ]),
    ).toBe(true)
  })
})
