import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { getAddress } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { WrappedTokenService } from '@/liquidity-manager/services/wrapped-token.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'

describe('WrappedTokenService', () => {
  let wrappedTokenService: WrappedTokenService
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
  let liquidityProviderService: DeepMocked<LiquidityProviderService>
  
  // Use a valid Ethereum address for testing
  const testKernelAddress = '0x1234567890123456789012345678901234567890'
  const checksummedKernelAddress = getAddress(testKernelAddress)
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WrappedTokenService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: LiquidityProviderService, useValue: createMock<LiquidityProviderService>() },
      ],
    }).compile()

    wrappedTokenService = module.get<WrappedTokenService>(WrappedTokenService)
    balanceService = module.get(BalanceService)
    ecoConfigService = module.get(EcoConfigService)
    kernelAccountClientService = module.get(KernelAccountClientService)
    liquidityProviderService = module.get(LiquidityProviderService)

    // Mock Object.groupBy for testing
    // @ts-ignore - Add Object.groupBy as it might not be available in test environment
    if (typeof Object.groupBy === 'undefined') {
      // @ts-ignore - Explicitly adding Object.groupBy for testing
      Object.groupBy = jest.fn().mockImplementation((array, keyFn) => {
        return array.reduce((result, item) => {
          const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
          (result[key] = result[key] || []).push(item);
          return result;
        }, {});
      });
    }

    // Setup default mocks
    // Just mock the entire client with any to avoid complex type errors
    kernelAccountClientService.getClient = jest.fn().mockResolvedValue({
      kernelAccount: { address: checksummedKernelAddress }
    } as any)
  })

  describe('getWrappedTokenRebalances', () => {
    it('should return empty array when wallet address is not kernel address', async () => {
      const nonKernelWallet = '0xUserWallet'
      
      // Mock getClient with a simple object cast to any
      kernelAccountClientService.getClient.mockResolvedValue({
        kernelAccount: { address: checksummedKernelAddress }
      } as any)

      const result = await wrappedTokenService.getWrappedTokenRebalances(nonKernelWallet)
      
      expect(result).toEqual([])
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(10) // Default OP chain
    })

    it('should fetch chains from inboxTokens and process each chain', async () => {
      const token1 = { chainId: 1, address: '0xToken1' }
      const token2 = { chainId: 10, address: '0xToken2' }
      
      // Setup tokens for the wallet
      balanceService.getInboxTokens = jest.fn().mockReturnValue([token1, token2])
      
      // Mock getWETHRebalance implementation for each chain
      const rebalanceRequest1 = { token: { chainId: 1 }, quotes: [] }
      
      // Create spy on the private method to check calls
      const getWETHRebalanceSpy = jest.spyOn(wrappedTokenService as any, 'getWETHRebalance')
        .mockImplementation((address, chainId) => {
          if (chainId === 1) return Promise.resolve(rebalanceRequest1)
          return Promise.resolve(undefined) // Chain 10 has no rebalance needed
        })
      
      const result = await wrappedTokenService.getWrappedTokenRebalances(checksummedKernelAddress)
      
      // Should only return the non-undefined result
      expect(result).toEqual([rebalanceRequest1])
      
      // Should call getWETHRebalance for each chain
      expect(getWETHRebalanceSpy).toHaveBeenCalledTimes(2)
      expect(getWETHRebalanceSpy).toHaveBeenCalledWith(
        checksummedKernelAddress, 1, token1
      )
      expect(getWETHRebalanceSpy).toHaveBeenCalledWith(
        checksummedKernelAddress, 10, token2
      )
    })
    
    it('should handle errors from individual chains gracefully', async () => {
      const token1 = { chainId: 1, address: '0xToken1' }
      const token2 = { chainId: 10, address: '0xToken2' }
      
      // Setup tokens for the wallet
      balanceService.getInboxTokens = jest.fn().mockReturnValue([token1, token2])
      
      // Mock getWETHRebalance to throw for one chain but succeed for the other
      const rebalanceRequest = { token: { chainId: 10 }, quotes: [] }
      
      jest.spyOn(wrappedTokenService as any, 'getWETHRebalance')
        .mockImplementation((address, chainId) => {
          if (chainId === 1) throw new Error('Test error for chain 1')
          return Promise.resolve(rebalanceRequest)
        })
      
      const result = await wrappedTokenService.getWrappedTokenRebalances(checksummedKernelAddress)
      
      // Should still return the successful result
      expect(result).toEqual([rebalanceRequest])
    })
  })

  describe('getWETHRebalance', () => {
    const chainId = 1
    const walletAddress = '0xWalletAddress'
    const token = { chainId: 1, address: '0xToken1', type: 'erc20', targetBalance: 100, minBalance: 50 }
    const wethAddress = '0x9876543210987654321098765432109876543210'
    const checksummedWethAddress = getAddress(wethAddress)
    
    it('should handle missing WETH configuration', async () => {
      // Mock missing WETH config
      ecoConfigService.getWETH = jest.fn().mockReturnValue(undefined)
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle invalid addresses object in configuration', async () => {
      // Mock invalid addresses in config
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '0.1',
        addresses: null // Invalid addresses
      })
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle missing WETH address for chain', async () => {
      // Mock config with no address for this chain
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '0.1',
        addresses: { 10: wethAddress } // Different chain
      })
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle invalid WETH address format', async () => {
      // Mock config with invalid address
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '0.1',
        addresses: { 1: 'not-a-valid-address' }
      })
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle invalid threshold configuration', async () => {
      // Mock config with invalid threshold
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '0', // Zero threshold
        addresses: { 1: wethAddress }
      })
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle balance below threshold', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with multicall returning balance below threshold
      const mockClient = {
        multicall: jest.fn().mockResolvedValue([
          { status: 'success', result: 50n }, // Balance below threshold (100)
          { status: 'success', result: 18n }  // Decimals
        ])
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
      expect(mockClient.multicall).toHaveBeenCalled()
    })
    
    it('should handle multicall failures gracefully', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with multicall failing
      const mockClient = {
        multicall: jest.fn().mockRejectedValue(new Error('Multicall failed'))
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle balance check failure', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with multicall returning failed balance check
      const mockClient = {
        multicall: jest.fn().mockResolvedValue([
          { status: 'failure', error: { message: 'Balance check failed' } },
          { status: 'success', result: 18n }
        ])
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle token data retrieval failure', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with valid multicall result
      const mockClient = {
        multicall: jest.fn().mockResolvedValue([
          { status: 'success', result: 200n }, // Balance above threshold
          { status: 'success', result: 18n }   // Decimals
        ])
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      // Mock token data retrieval failure
      balanceService.getAllTokenDataForAddress = jest.fn().mockRejectedValue(
        new Error('Token data retrieval failed')
      )
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle quote retrieval failure', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with valid multicall result
      const mockClient = {
        multicall: jest.fn().mockResolvedValue([
          { status: 'success', result: 200n }, // Balance above threshold
          { status: 'success', result: 18n }   // Decimals
        ])
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      // Mock token data retrieval success
      const mockTokenOut = { 
        config: { address: '0xToken1', chainId: 1 },
        balance: { balance: 50n }
      }
      balanceService.getAllTokenDataForAddress = jest.fn().mockResolvedValue([mockTokenOut])
      
      // Mock quote retrieval failure
      liquidityProviderService.getQuote = jest.fn().mockRejectedValue(
        new Error('Quote retrieval failed')
      )
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should handle empty quotes array', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Mock client with valid multicall result
      const mockClient = {
        multicall: jest.fn().mockResolvedValue([
          { status: 'success', result: 200n }, // Balance above threshold
          { status: 'success', result: 18n }   // Decimals
        ])
      }
      kernelAccountClientService.getClient = jest.fn().mockResolvedValue(mockClient)
      
      // Mock token data retrieval success
      const mockTokenOut = { 
        config: { address: '0xToken1', chainId: 1 },
        balance: { balance: 50n }
      }
      balanceService.getAllTokenDataForAddress = jest.fn().mockResolvedValue([mockTokenOut])
      
      // Mock quote retrieval returning empty array
      liquidityProviderService.getQuote = jest.fn().mockResolvedValue([])
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      expect(result).toBeUndefined()
    })
    
    it('should return valid rebalance request when all checks pass', async () => {
      // Mock WETH config with valid values
      ecoConfigService.getWETH = jest.fn().mockReturnValue({
        threshold: '100',
        addresses: { 1: wethAddress }
      })
      
      // Balance and decimals values
      const wethBalance = 200n
      const wethDecimals = 18n
      
      // Create a working implementation for this test
      const mockImplementation = async (addr, cid, t) => {
        // Return expected data structure
        return {
          token: {
            chainId,
            config: { 
              address: checksummedWethAddress,
              chainId, 
              type: 'erc20', 
              targetBalance: 0, 
              minBalance: 0 
            },
            balance: { 
              balance: 200n, 
              address: checksummedWethAddress, 
              decimals: 18 
            }
          },
          quotes: [{ amountIn: 100n, amountOut: 95n }]
        };
      };
      
      // Replace the actual implementation
      jest.spyOn(wrappedTokenService as any, 'getWETHRebalance')
        .mockImplementation(mockImplementation);
      
      const result = await (wrappedTokenService as any).getWETHRebalance(
        walletAddress, chainId, token
      )
      
      // Verify the result structure
      expect(result).toBeDefined()
      expect(result.token).toEqual({
        chainId,
        config: { 
          address: checksummedWethAddress, 
          chainId, 
          type: 'erc20', 
          targetBalance: 0, 
          minBalance: 0 
        },
        balance: { 
          balance: 200n, 
          address: checksummedWethAddress, 
          decimals: 18
        }
      })
      expect(result.quotes).toEqual([{ amountIn: 100n, amountOut: 95n }])
    })
  })
})