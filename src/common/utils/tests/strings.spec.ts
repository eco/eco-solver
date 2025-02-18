import { obscureCenter } from '@/common/utils/strings'

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
