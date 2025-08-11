describe('Decorators Utils', () => {
  describe('serializeWithBigInt', () => {
    it('should serialize simple BigInt values', () => {
      const obj = { balance: 1000n }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.balance).toEqual({ __type: 'BigInt', value: '1000' })
    })

    it('should serialize nested BigInt values', () => {
      const obj = {
        user: {
          id: 123,
          balance: 500000000000000000n,
          metadata: {
            lastUpdate: 1640995200000n,
          },
        },
      }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.user.balance).toEqual({ __type: 'BigInt', value: '500000000000000000' })
      expect(parsed.user.metadata.lastUpdate).toEqual({ __type: 'BigInt', value: '1640995200000' })
      expect(parsed.user.id).toBe(123)
    })

    it('should serialize BigInt values in arrays', () => {
      const obj = {
        balances: [100n, 200n, 300n],
        mixed: [1, 'test', 500n, true],
      }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.balances[0]).toEqual({ __type: 'BigInt', value: '100' })
      expect(parsed.balances[1]).toEqual({ __type: 'BigInt', value: '200' })
      expect(parsed.balances[2]).toEqual({ __type: 'BigInt', value: '300' })
      expect(parsed.mixed[0]).toBe(1)
      expect(parsed.mixed[1]).toBe('test')
      expect(parsed.mixed[2]).toEqual({ __type: 'BigInt', value: '500' })
      expect(parsed.mixed[3]).toBe(true)
    })

    it('should handle zero BigInt values', () => {
      const obj = { zero: 0n }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.zero).toEqual({ __type: 'BigInt', value: '0' })
    })

    it('should handle negative BigInt values', () => {
      const obj = { negative: -1000n }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.negative).toEqual({ __type: 'BigInt', value: '-1000' })
    })

    it('should handle very large BigInt values', () => {
      const largeValue = BigInt('123456789012345678901234567890')
      const obj = { large: largeValue }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.large).toEqual({ __type: 'BigInt', value: '123456789012345678901234567890' })
    })

    it('should preserve non-BigInt values unchanged', () => {
      const obj = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        date: new Date('2023-01-01'),
        regex: /test/,
      }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.string).toBe('hello')
      expect(parsed.number).toBe(42)
      expect(parsed.boolean).toBe(true)
      expect(parsed.null).toBe(null)
      expect(parsed.undefined).toBeUndefined()
      expect(parsed.date).toBe('2023-01-01T00:00:00.000Z')
      expect(parsed.regex).toEqual({})
    })

    it('should handle empty objects and arrays', () => {
      const obj = {
        emptyObj: {},
        emptyArray: [],
      }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.emptyObj).toEqual({})
      expect(parsed.emptyArray).toEqual([])
    })

    it('should handle complex nested structures', () => {
      const obj = {
        tokens: [
          { address: '0x123', balance: 1000n, decimals: 18 },
          { address: '0x456', balance: 2000n, decimals: 6 },
        ],
        nativeBalance: 500000000000000000n,
        metadata: {
          lastUpdated: 1640995200000n,
          chainId: 1,
          fees: {
            base: 21000n,
            priority: 2000000000n,
          },
        },
      }
      const serialized = serializeWithBigInt(obj)
      const parsed = JSON.parse(serialized)

      expect(parsed.tokens[0].balance).toEqual({ __type: 'BigInt', value: '1000' })
      expect(parsed.tokens[1].balance).toEqual({ __type: 'BigInt', value: '2000' })
      expect(parsed.nativeBalance).toEqual({ __type: 'BigInt', value: '500000000000000000' })
      expect(parsed.metadata.lastUpdated).toEqual({ __type: 'BigInt', value: '1640995200000' })
      expect(parsed.metadata.fees.base).toEqual({ __type: 'BigInt', value: '21000' })
      expect(parsed.metadata.fees.priority).toEqual({ __type: 'BigInt', value: '2000000000' })
    })
  })

  describe('deserializeWithBigInt', () => {
    it('should deserialize simple BigInt values', () => {
      const serialized = '{"balance":{"__type":"BigInt","value":"1000"}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.balance).toBe(1000n)
      expect(typeof obj.balance).toBe('bigint')
    })

    it('should deserialize nested BigInt values', () => {
      const serialized =
        '{"user":{"id":123,"balance":{"__type":"BigInt","value":"500000000000000000"},"metadata":{"lastUpdate":{"__type":"BigInt","value":"1640995200000"}}}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.user.balance).toBe(500000000000000000n)
      expect(obj.user.metadata.lastUpdate).toBe(1640995200000n)
      expect(obj.user.id).toBe(123)
    })

    it('should deserialize BigInt values in arrays', () => {
      const serialized =
        '{"balances":[{"__type":"BigInt","value":"100"},{"__type":"BigInt","value":"200"},{"__type":"BigInt","value":"300"}],"mixed":[1,"test",{"__type":"BigInt","value":"500"},true]}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.balances[0]).toBe(100n)
      expect(obj.balances[1]).toBe(200n)
      expect(obj.balances[2]).toBe(300n)
      expect(obj.mixed[0]).toBe(1)
      expect(obj.mixed[1]).toBe('test')
      expect(obj.mixed[2]).toBe(500n)
      expect(obj.mixed[3]).toBe(true)
    })

    it('should handle zero BigInt values', () => {
      const serialized = '{"zero":{"__type":"BigInt","value":"0"}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.zero).toBe(0n)
    })

    it('should handle negative BigInt values', () => {
      const serialized = '{"negative":{"__type":"BigInt","value":"-1000"}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.negative).toBe(-1000n)
    })

    it('should handle very large BigInt values', () => {
      const serialized = '{"large":{"__type":"BigInt","value":"123456789012345678901234567890"}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.large).toBe(BigInt('123456789012345678901234567890'))
    })

    it('should preserve non-BigInt values unchanged', () => {
      const serialized =
        '{"string":"hello","number":42,"boolean":true,"null":null,"date":"2023-01-01T00:00:00.000Z"}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.string).toBe('hello')
      expect(obj.number).toBe(42)
      expect(obj.boolean).toBe(true)
      expect(obj.null).toBe(null)
      expect(obj.date).toBe('2023-01-01T00:00:00.000Z')
    })

    it('should handle empty objects and arrays', () => {
      const serialized = '{"emptyObj":{},"emptyArray":[]}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.emptyObj).toEqual({})
      expect(obj.emptyArray).toEqual([])
    })

    it('should handle malformed BigInt serialization gracefully', () => {
      const serialized = '{"invalid":{"__type":"BigInt","value":"not-a-number"}}'

      expect(() => deserializeWithBigInt(serialized)).toThrow()
    })

    it('should handle incomplete BigInt serialization', () => {
      const serialized = '{"incomplete":{"__type":"BigInt"}}'

      // Should throw when trying to convert undefined to BigInt
      expect(() => deserializeWithBigInt(serialized)).toThrow()
    })

    it('should handle objects that look like BigInt but are not', () => {
      const serialized = '{"fake":{"__type":"NotBigInt","value":"123"}}'
      const obj = deserializeWithBigInt(serialized) as any

      expect(obj.fake).toEqual({ __type: 'NotBigInt', value: '123' })
    })
  })

  describe('round-trip serialization', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const original = {
        simple: 1000n,
        nested: {
          balance: 500000000000000000n,
          count: 42,
        },
        array: [100n, 200n, 'string', true],
        zero: 0n,
        negative: -1000n,
        large: BigInt('123456789012345678901234567890'),
      }

      const serialized = serializeWithBigInt(original)
      const deserialized = deserializeWithBigInt(serialized) as any

      expect(deserialized.simple).toBe(1000n)
      expect(deserialized.nested.balance).toBe(500000000000000000n)
      expect(deserialized.nested.count).toBe(42)
      expect(deserialized.array[0]).toBe(100n)
      expect(deserialized.array[1]).toBe(200n)
      expect(deserialized.array[2]).toBe('string')
      expect(deserialized.array[3]).toBe(true)
      expect(deserialized.zero).toBe(0n)
      expect(deserialized.negative).toBe(-1000n)
      expect(deserialized.large).toBe(BigInt('123456789012345678901234567890'))
    })

    it('should handle TokenBalance-like objects', () => {
      const tokenBalance = {
        address: '0x123456789abcdef',
        balance: 1000000000000000000n, // 1 ETH in wei
        decimals: 18,
      }

      const serialized = serializeWithBigInt(tokenBalance)
      const deserialized = deserializeWithBigInt(serialized) as any

      expect(deserialized.address).toBe('0x123456789abcdef')
      expect(deserialized.balance).toBe(1000000000000000000n)
      expect(deserialized.decimals).toBe(18)
      expect(typeof deserialized.balance).toBe('bigint')
    })

    it('should handle Record<string, TokenBalance>-like objects', () => {
      const tokenBalances = {
        '0xToken1': { address: '0xToken1', balance: 1000n, decimals: 6 },
        '0xToken2': { address: '0xToken2', balance: 2000n, decimals: 18 },
      }

      const serialized = serializeWithBigInt(tokenBalances)
      const deserialized = deserializeWithBigInt(serialized) as any

      expect(deserialized['0xToken1'].balance).toBe(1000n)
      expect(deserialized['0xToken2'].balance).toBe(2000n)
      expect(typeof deserialized['0xToken1'].balance).toBe('bigint')
      expect(typeof deserialized['0xToken2'].balance).toBe('bigint')
    })
  })

  describe('edge cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(serializeWithBigInt(null)).toBe('null')
      expect(serializeWithBigInt(undefined)).toBe(undefined)
    })

    it('should handle empty string serialization', () => {
      expect(() => deserializeWithBigInt('')).toThrow()
    })

    it('should handle invalid JSON', () => {
      expect(() => deserializeWithBigInt('invalid json')).toThrow()
    })

    it('should handle circular references gracefully', () => {
      const obj: any = { value: 100n }
      obj.self = obj

      expect(() => serializeWithBigInt(obj)).toThrow()
    })

    it('should handle very deep nesting', () => {
      let deep: any = { value: 1000n }
      for (let i = 0; i < 100; i++) {
        deep = { nested: deep, level: i }
      }

      const serialized = serializeWithBigInt(deep)
      const deserialized = deserializeWithBigInt(serialized) as any

      let current = deserialized
      for (let i = 99; i >= 0; i--) {
        expect(current.level).toBe(i)
        current = current.nested
      }
      expect(current.value).toBe(1000n)
    })
  })
})
