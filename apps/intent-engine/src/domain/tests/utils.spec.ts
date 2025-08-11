const mockDecodeFunctionData = jest.fn()
const mockExtractChain = jest.fn()
const mockIsEmptyData = jest.fn()
  getTransactionTargetData,
  getWaitForTransactionTimeout,
  isNativeIntent,
  equivalentNativeGas,
  getFunctionCalls,
  getNativeCalls,
  getNativeFulfill,
  getFunctionTargets,
  isNativeETH,
} from '@app/intent/utils'

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    decodeFunctionData: mockDecodeFunctionData,
    extractChain: mockExtractChain,
  }
})

jest.mock('integrations/blockchain/utils', () => {
  return {
    ...jest.requireActual('integrations/blockchain/utils'),
    isEmptyData: mockIsEmptyData,
  }
})

const address1 = '0x1111111111111111111111111111111111111111'
describe('utils tests', () => {
  describe('on getTransactionTargetData', () => {
    const callData: CallDataInterface = { target: address1, data: '0xa9059cbb3333333', value: 0n } //transfer selector plus data fake
    const selectors = ['transfer(address,uint256)']
    const targetConfig = { contractType: 'erc20', selectors }
    const decodedData = { stuff: true }

    it('should throw when no target config exists on solver', async () => {
      const solver = { targets: {} }
      expect(() => getTransactionTargetData(solver as any, callData)).toThrow(
        EcoError.IntentSourceTargetConfigNotFound(callData.target as string),
      )
    })

    it('should return null when tx is not decoded ', async () => {
      mockDecodeFunctionData.mockReturnValue(null)
      expect(
        getTransactionTargetData(
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          callData,
        ),
      ).toBe(null)
    })

    it('should return null when target selector is not supported by the solver', async () => {
      const fakeData = '0xaaaaaaaa11112333'
      const call: CallDataInterface = { target: callData.target, data: fakeData, value: 0n }
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        getTransactionTargetData(
          { targets: { [address1]: { contractType: 'erc20', selectors } } } as any,
          call,
        ),
      ).toBe(null)
    })

    it('should return the decoded function data, selctor and target config when successful', async () => {
      mockDecodeFunctionData.mockReturnValue(decodedData)
      expect(
        getTransactionTargetData({ targets: { [address1]: targetConfig } } as any, callData),
      ).toEqual({
        decodedFunctionData: decodedData,
        selector: getFunctionBytes(callData.data),
        targetConfig,
      })
    })
  })

  describe('on getWaitForTransactionTimeout', () => {
    it('should return the timeout for mainnet', () => {
      expect(getWaitForTransactionTimeout(1n)).toEqual(1000 * 60 * 5)
    })
    it('should return undefined for other chains', () => {
      expect(getWaitForTransactionTimeout(2n)).toEqual(undefined)
      expect(getWaitForTransactionTimeout(137n)).toEqual(undefined)
      expect(getWaitForTransactionTimeout(84523n)).toEqual(undefined)
    })
  })

  describe('on isNativeIntent', () => {
    it('should return true when route has calls with value > 0', () => {
      const intent = {
        route: {
          calls: [
            { value: 0n, target: '0x1', data: '0x' },
            { value: 100n, target: '0x2', data: '0x' },
          ],
        },
        reward: { nativeValue: 0n },
      } as any

      expect(isNativeIntent(intent)).toBe(true)
    })

    it('should return true when reward has nativeValue > 0', () => {
      const intent = {
        route: {
          calls: [{ value: 0n, target: '0x1', data: '0x' }],
        },
        reward: { nativeValue: 500n },
      } as any

      expect(isNativeIntent(intent)).toBe(true)
    })

    it('should return true when both route calls and reward have native values', () => {
      const intent = {
        route: {
          calls: [{ value: 100n, target: '0x1', data: '0x' }],
        },
        reward: { nativeValue: 500n },
      } as any

      expect(isNativeIntent(intent)).toBe(true)
    })

    it('should return false when no calls have value and reward nativeValue is 0', () => {
      const intent = {
        route: {
          calls: [
            { value: 0n, target: '0x1', data: '0x' },
            { value: 0n, target: '0x2', data: '0x' },
          ],
        },
        reward: { nativeValue: 0n },
      } as any

      expect(isNativeIntent(intent)).toBe(false)
    })

    it('should return false when route has no calls and reward nativeValue is 0', () => {
      const intent = {
        route: { calls: [] },
        reward: { nativeValue: 0n },
      } as any

      expect(isNativeIntent(intent)).toBe(false)
    })
  })

  describe('on equivalentNativeGas', () => {
    let mockLogger: jest.Mocked<Logger>

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      } as any
      mockExtractChain.mockClear()
    })

    it('should return false when source chain is not found', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce(null) // source chain not found
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // destination chain

      expect(equivalentNativeGas(intent, mockLogger)).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'equivalentNativeGas: Chain not found',
        }),
      )
    })

    it('should return false when destination chain is not found', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // source chain
      mockExtractChain.mockReturnValueOnce(null) // destination chain not found

      expect(equivalentNativeGas(intent, mockLogger)).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'equivalentNativeGas: Chain not found',
        }),
      )
    })

    it('should return false when chains have different decimals', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // source
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 6, symbol: 'ETH' } }) // destination

      expect(equivalentNativeGas(intent, mockLogger)).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'equivalentNativeGas: Different native currency',
          sameDecimals: false,
        }),
      )
    })

    it('should return false when chains have different symbols', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // source
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'MATIC' } }) // destination

      expect(equivalentNativeGas(intent, mockLogger)).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'equivalentNativeGas: Different native currency',
          sameSymbol: false,
        }),
      )
    })

    it('should return false when source chain decimals are not 18', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 6, symbol: 'ETH' } }) // source
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 6, symbol: 'ETH' } }) // destination

      expect(equivalentNativeGas(intent, mockLogger)).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'equivalentNativeGas: Different native currency',
        }),
      )
    })

    it('should return true when chains have same currency with 18 decimals', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // source
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { decimals: 18, symbol: 'ETH' } }) // destination

      expect(equivalentNativeGas(intent, mockLogger)).toBe(true)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should call extractChain with correct parameters', () => {
      const intent = {
        route: { source: 1n, destination: 137n },
      } as any

      mockExtractChain.mockReturnValue({ nativeCurrency: { decimals: 18, symbol: 'ETH' } })

      equivalentNativeGas(intent, mockLogger)

      expect(mockExtractChain).toHaveBeenCalledTimes(2)
      expect(mockExtractChain).toHaveBeenNthCalledWith(1, {
        chains: expect.anything(),
        id: 1,
      })
      expect(mockExtractChain).toHaveBeenNthCalledWith(2, {
        chains: expect.anything(),
        id: 137,
      })
    })
  })

  describe('on getFunctionCalls', () => {
    beforeEach(() => {
      mockIsEmptyData.mockClear()
      mockIsEmptyData.mockReset()
    })

    it('should return calls that have non-empty data and zero value', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n }, // function call (valid)
        { target: '0x2', data: '0x', value: 100n }, // native transfer (excluded)
        { target: '0x3', data: '0x1234', value: 0n }, // function call (valid)
        { target: '0x4', data: '0xabcd', value: 50n }, // function call with value (excluded)
      ]

      mockIsEmptyData.mockReturnValueOnce(false) // first call has data
      mockIsEmptyData.mockReturnValueOnce(true) // second call is empty
      mockIsEmptyData.mockReturnValueOnce(false) // third call has data
      mockIsEmptyData.mockReturnValueOnce(false) // fourth call has data but value > 0

      const result = getFunctionCalls(calls)

      expect(result).toEqual([calls[0], calls[2]])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(4)
      expect(mockIsEmptyData).toHaveBeenNthCalledWith(1, '0xa9059cbb')
      expect(mockIsEmptyData).toHaveBeenNthCalledWith(2, '0x')
      expect(mockIsEmptyData).toHaveBeenNthCalledWith(3, '0x1234')
      expect(mockIsEmptyData).toHaveBeenNthCalledWith(4, '0xabcd')
    })

    it('should return empty array when all calls have empty data or non-zero value', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 0n }, // empty data (excluded)
        { target: '0x2', data: '0x', value: 100n }, // empty data + value (excluded)
        { target: '0x3', data: '0xabcd', value: 50n }, // has data but value > 0 (excluded)
      ]

      mockIsEmptyData.mockReturnValue(true) // all calls have empty data

      const result = getFunctionCalls(calls)

      expect(result).toEqual([])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(3)
    })

    it('should return all calls when they have non-empty data and zero value', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n },
        { target: '0x2', data: '0x1234', value: 0n },
      ]

      mockIsEmptyData.mockReturnValue(false)

      const result = getFunctionCalls(calls)

      expect(result).toEqual(calls)
      expect(mockIsEmptyData).toHaveBeenCalledTimes(2)
    })

    it('should exclude calls with non-zero value even if they have data', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 100n }, // has data but value > 0 (excluded)
        { target: '0x2', data: '0x1234', value: 200n }, // has data but value > 0 (excluded)
      ]

      mockIsEmptyData.mockReturnValue(false) // all calls have data

      const result = getFunctionCalls(calls)

      expect(result).toEqual([])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(2)
    })

    it('should handle empty calls array', () => {
      const result = getFunctionCalls([])
      expect(result).toEqual([])
      expect(mockIsEmptyData).not.toHaveBeenCalled()
    })

    it('should handle mixed scenarios correctly', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n }, // function call (valid)
        { target: '0x2', data: '0x', value: 0n }, // empty data, no value (excluded)
        { target: '0x3', data: '0x1234', value: 100n }, // has data but value > 0 (excluded)
        { target: '0x4', data: '0x', value: 200n }, // native transfer (excluded)
        { target: '0x5', data: '0xdeadbeef', value: 0n }, // function call (valid)
      ]

      mockIsEmptyData.mockReturnValueOnce(false) // first call has data
      mockIsEmptyData.mockReturnValueOnce(true) // second call is empty
      mockIsEmptyData.mockReturnValueOnce(false) // third call has data
      mockIsEmptyData.mockReturnValueOnce(true) // fourth call is empty
      mockIsEmptyData.mockReturnValueOnce(false) // fifth call has data

      const result = getFunctionCalls(calls)

      expect(result).toEqual([calls[0], calls[4]])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(5)
    })
  })

  describe('on getNativeCalls', () => {
    beforeEach(() => {
      mockIsEmptyData.mockClear()
    })

    it('should return calls that have value > 0 and empty data', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n }, // function call, no value
        { target: '0x2', data: '0x', value: 100n }, // native transfer
        { target: '0x3', data: '0x1234', value: 200n }, // function call with value
        { target: '0x4', data: '0x', value: 300n }, // native transfer
      ]

      // getNativeCalls filters by call.value > 0 AND isEmptyData(call.data)
      // So it will check all calls for value > 0 first, then check isEmptyData for those that qualify
      mockIsEmptyData.mockReturnValueOnce(true) // second call (value=100n) is empty
      mockIsEmptyData.mockReturnValueOnce(false) // third call (value=200n) has data
      mockIsEmptyData.mockReturnValueOnce(true) // fourth call (value=300n) is empty

      const result = getNativeCalls(calls)

      expect(result).toEqual([calls[1], calls[3]])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(3) // Only called for calls with value > 0
    })

    it('should return empty array when no calls have both value and empty data', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 100n }, // has value but not empty data
        { target: '0x2', data: '0x', value: 0n }, // empty data but no value
      ]

      mockIsEmptyData.mockReturnValueOnce(false) // first call has data (value > 0 so isEmptyData is checked)

      const result = getNativeCalls(calls)

      expect(result).toEqual([])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(1) // Only called for the call with value > 0
    })

    it('should return empty array when all calls have value 0', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 0n },
        { target: '0x2', data: '0x', value: 0n },
      ]

      const result = getNativeCalls(calls)

      expect(result).toEqual([])
      expect(mockIsEmptyData).toHaveBeenCalledTimes(0) // Not called because no calls have value > 0
    })

    it('should handle empty calls array', () => {
      const result = getNativeCalls([])
      expect(result).toEqual([])
      expect(mockIsEmptyData).not.toHaveBeenCalled()
    })
  })

  describe('on getFunctionTargets', () => {
    beforeEach(() => {
      mockIsEmptyData.mockClear()
    })

    it('should return targets from function calls only', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n },
        { target: '0x2', data: '0x', value: 100n },
        { target: '0x3', data: '0x1234', value: 0n },
      ]

      mockIsEmptyData.mockReturnValueOnce(false) // first call has data
      mockIsEmptyData.mockReturnValueOnce(true) // second call is empty
      mockIsEmptyData.mockReturnValueOnce(false) // third call has data

      const result = getFunctionTargets(calls)

      expect(result).toEqual(['0x1', '0x3'])
    })

    it('should return empty array when no function calls exist', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 100n },
        { target: '0x2', data: '0x', value: 200n },
      ]

      mockIsEmptyData.mockReturnValue(true) // all calls have empty data

      const result = getFunctionTargets(calls)

      expect(result).toEqual([])
    })

    it('should handle duplicate targets', () => {
      const calls: CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 0n },
        { target: '0x1', data: '0x1234', value: 0n },
      ]

      mockIsEmptyData.mockReturnValue(false) // both have data

      const result = getFunctionTargets(calls)

      expect(result).toEqual(['0x1', '0x1']) // duplicates preserved
    })

    it('should handle empty calls array', () => {
      const result = getFunctionTargets([])

      expect(result).toEqual([])
    })
  })

  describe('on getNativeFulfill', () => {
    beforeEach(() => {
      mockIsEmptyData.mockClear()
      mockIsEmptyData.mockReset()
    })

    it('should return total native value from all native calls', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 100n }, // function call with value
        { target: '0x2', data: '0x', value: 200n }, // native transfer
        { target: '0x3', data: '0x1234', value: 300n }, // function call with value
        { target: '0x4', data: '0x', value: 400n }, // native transfer
        { target: '0x5', data: '0x', value: 0n }, // no value
      ]

      // Mock isEmptyData to return true for native transfers (empty data)
      mockIsEmptyData.mockReturnValueOnce(false) // first call has data
      mockIsEmptyData.mockReturnValueOnce(true) // second call is empty (native)
      mockIsEmptyData.mockReturnValueOnce(false) // third call has data
      mockIsEmptyData.mockReturnValueOnce(true) // fourth call is empty (native)
      mockIsEmptyData.mockReturnValueOnce(true) // fifth call is empty but no value

      const result = getNativeFulfill(calls)

      // Only calls with value > 0 AND empty data should be included: 200n + 400n = 600n
      expect(result).toBe(600n)
      expect(mockIsEmptyData).toHaveBeenCalledTimes(4) // Only called for calls with value > 0
    })

    it('should return 0n when no native calls exist', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0xa9059cbb', value: 100n }, // function call with value (not native)
        { target: '0x2', data: '0x1234', value: 200n }, // function call with value (not native)
        { target: '0x3', data: '0x', value: 0n }, // empty data but no value
      ]

      // Set mock to always return false for non-empty data
      mockIsEmptyData.mockReturnValue(false)

      const result = getNativeFulfill(calls)

      expect(result).toBe(0n)
      expect(mockIsEmptyData).toHaveBeenCalledTimes(2) // Only called for calls with value > 0
    })

    it('should return 0n when all calls have value 0', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 0n },
        { target: '0x2', data: '0x', value: 0n },
      ]

      const result = getNativeFulfill(calls)

      expect(result).toBe(0n)
      expect(mockIsEmptyData).toHaveBeenCalledTimes(0) // Not called because no calls have value > 0
    })

    it('should handle empty calls array', () => {
      const result = getNativeFulfill([])

      expect(result).toBe(0n)
      expect(mockIsEmptyData).not.toHaveBeenCalled()
    })

    it('should handle calls with undefined value property', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 100n },
        { target: '0x2', data: '0x' } as any, // missing value property
        { target: '0x3', data: '0x', value: 200n },
      ]

      mockIsEmptyData.mockReturnValue(true) // all calls with empty data are native

      const result = getNativeFulfill(calls)

      // Only calls with value > 0 AND empty data are included: 100n + 200n = 300n
      // The call with undefined value doesn't pass call.value > 0 filter
      expect(result).toBe(300n)
      expect(mockIsEmptyData).toHaveBeenCalledTimes(2) // Only called for calls with value > 0
    })

    it('should work with readonly arrays', () => {
      const calls = [{ target: '0x1', data: '0x', value: 500n }] as const

      mockIsEmptyData.mockReturnValueOnce(true)

      const result = getNativeFulfill(calls)

      expect(result).toBe(500n)
    })

    it('should sum multiple native transfers correctly', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0x', value: 1000000000000000000n }, // 1 ETH
        { target: '0x2', data: '0x', value: 2000000000000000000n }, // 2 ETH
        { target: '0x3', data: '0x', value: 500000000000000000n }, // 0.5 ETH
      ]

      mockIsEmptyData.mockReturnValue(true) // all are native transfers

      const result = getNativeFulfill(calls)

      expect(result).toBe(3500000000000000000n) // 3.5 ETH total
      expect(mockIsEmptyData).toHaveBeenCalledTimes(3)
    })

    it('should handle very large values', () => {
      const calls: readonly CallDataInterface[] = [
        { target: '0x1', data: '0x', value: BigInt('999999999999999999999999999999') },
        { target: '0x2', data: '0x', value: BigInt('1') },
      ]

      mockIsEmptyData.mockReturnValue(true)

      const result = getNativeFulfill(calls)

      expect(result).toBe(BigInt('1000000000000000000000000000000'))
    })
  })

  describe('on isNativeETH', () => {
    beforeEach(() => {
      mockExtractChain.mockClear()
    })

    it('should return true when both chains are ETH', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // source chain
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // destination chain

      expect(isNativeETH(intent)).toBe(true)
    })

    it('should return false when source chain is not found', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce(null) // source chain not found
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // destination chain

      expect(isNativeETH(intent)).toBe(false)
    })

    it('should return false when destination chain is not found', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // source chain
      mockExtractChain.mockReturnValueOnce(null) // destination chain not found

      expect(isNativeETH(intent)).toBe(false)
    })

    it('should return false when source chain is not ETH', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'MATIC' } }) // source chain
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // destination chain

      expect(isNativeETH(intent)).toBe(false)
    })

    it('should return false when destination chain is not ETH', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'ETH' } }) // source chain
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'MATIC' } }) // destination chain

      expect(isNativeETH(intent)).toBe(false)
    })

    it('should return false when both chains are not ETH', () => {
      const intent = {
        route: { source: 1n, destination: 2n },
      } as any

      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'MATIC' } }) // source chain
      mockExtractChain.mockReturnValueOnce({ nativeCurrency: { symbol: 'MATIC' } }) // destination chain

      expect(isNativeETH(intent)).toBe(false)
    })

    it('should call extractChain with correct parameters', () => {
      const intent = {
        route: { source: 1n, destination: 137n },
      } as any

      mockExtractChain.mockReturnValue({ nativeCurrency: { symbol: 'ETH' } })

      isNativeETH(intent)

      expect(mockExtractChain).toHaveBeenCalledTimes(2)
      expect(mockExtractChain).toHaveBeenNthCalledWith(1, {
        chains: expect.anything(),
        id: 1,
      })
      expect(mockExtractChain).toHaveBeenNthCalledWith(2, {
        chains: expect.anything(),
        id: 137,
      })
    })
  })
})
