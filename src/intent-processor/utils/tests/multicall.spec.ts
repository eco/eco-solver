import { getMulticall } from '@/intent-processor/utils/multicall'
import { extractChain } from 'viem'

// Mock the viem extractChain function
jest.mock('viem', () => ({
  extractChain: jest.fn(),
}))

// Mock the ChainsSupported import
jest.mock('@/common/chains/supported', () => ({
  ChainsSupported: [],
}))

describe('Multicall Utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('getMulticall', () => {
    it('should return multicall address if supported for chainID', () => {
      // Setup mock
      const mockChain = {
        contracts: {
          multicall3: {
            address: '0x1234567890123456789012345678901234567890',
          },
        },
      }
      ;(extractChain as jest.Mock).mockReturnValue(mockChain)

      // Execute
      const result = getMulticall(1)

      // Verify extractChain was called with correct params
      expect(extractChain).toHaveBeenCalledWith({
        chains: expect.any(Array),
        id: 1,
      })
      expect(result).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should throw error if multicall not supported for chainID', () => {
      // Setup mock for a chain without multicall
      const mockChain = {
        contracts: {},
      }
      ;(extractChain as jest.Mock).mockReturnValue(mockChain)

      // Execute and expect error
      expect(() => getMulticall(999)).toThrow('Multicall not supported for chain 999')

      // Verify extractChain was called
      expect(extractChain).toHaveBeenCalledWith({
        chains: expect.any(Array),
        id: 999,
      })
    })

    it('should throw error if contracts is undefined', () => {
      // Setup mock for a chain without contracts
      const mockChain = {}
      ;(extractChain as jest.Mock).mockReturnValue(mockChain)

      // Execute and expect error
      expect(() => getMulticall(888)).toThrow('Multicall not supported for chain 888')

      // Verify extractChain was called
      expect(extractChain).toHaveBeenCalledWith({
        chains: expect.any(Array),
        id: 888,
      })
    })
  })
})
