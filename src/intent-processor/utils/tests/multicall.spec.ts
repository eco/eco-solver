import { getMulticall } from '@/intent-processor/utils/multicall'
import { ChainsSupported } from '@/common/chains/supported'

// Mock ChainsSupported
jest.mock('@/common/chains/supported', () => ({
  ChainsSupported: [
    {
      id: 1,
      name: 'Ethereum',
      contracts: {
        multicall3: {
          address: '0x1111111111111111111111111111111111111111',
        },
      },
    },
    {
      id: 10,
      name: 'Optimism',
      contracts: {
        multicall3: {
          address: '0x2222222222222222222222222222222222222222',
        },
      },
    },
    {
      id: 42161,
      name: 'Arbitrum One',
      contracts: {
        // No multicall defined for this chain
      },
    },
  ],
}))

describe('Multicall utils', () => {
  describe('getMulticall', () => {
    it('should return the correct multicall address for Ethereum', () => {
      const result = getMulticall(1)
      expect(result).toBe('0x1111111111111111111111111111111111111111')
    })

    it('should return the correct multicall address for Optimism', () => {
      const result = getMulticall(10)
      expect(result).toBe('0x2222222222222222222222222222222222222222')
    })

    it('should throw an error when multicall is not supported for the chain', () => {
      expect(() => getMulticall(42161)).toThrow('Multicall not supported for chain 42161')
    })

    it('should throw an error when chain ID does not exist', () => {
      expect(() => getMulticall(999)).toThrow()
    })
  })
})