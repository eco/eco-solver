import { extractChain, Hex } from 'viem'
import { getMulticall } from '@/intent-processor/utils/multicall'

// Mock extractChain to provide controlled test responses
jest.mock('viem', () => {
  // Keep the original module
  const original = jest.requireActual('viem')
  
  return {
    ...original,
    // Mock the extractChain function
    extractChain: jest.fn().mockImplementation(({ id }) => {
      if (id === 99999) {
        return { id, name: 'Unsupported Chain', contracts: { multicall3: null } }
      }
      
      return { 
        id, 
        name: 'Mock Chain', 
        contracts: { 
          multicall3: { 
            address: '0xcA11bde05977b3631167028862bE2a173976CA11' as Hex 
          } 
        } 
      }
    })
  }
})

describe('Multicall Utilities', () => {
  describe('getMulticall', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    
    it('should call extractChain with the correct parameters', () => {
      // Call getMulticall with a chain ID
      getMulticall(1)
      
      // Verify extractChain was called with correct params
      expect(extractChain).toHaveBeenCalledWith({
        chains: expect.any(Array),
        id: 1
      })
    })
    
    it('should return the multicall address for supported chains', () => {
      // Get a multicall address for a supported chain
      const address = getMulticall(1)
      
      // Verify the result
      expect(address).toBe('0xcA11bde05977b3631167028862bE2a173976CA11')
    })
    
    it('should throw error for unsupported chains', () => {
      // Test with an unsupported chain ID that doesn't have multicall
      expect(() => getMulticall(99999)).toThrow('Multicall not supported for chain 99999')
    })
    
    it('should verify address format for all supported chains', () => {
      // Get addresses for a chain
      const address = getMulticall(1)
      
      // All addresses should be the same format (42 chars, starting with 0x)
      expect(address.length).toBe(42)
      expect(address.startsWith('0x')).toBe(true)
    })
  })
})
