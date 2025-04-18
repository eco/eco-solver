import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'

describe('LiquidityProviderService', () => {
  let liquidityProviderService: LiquidityProviderService
  let liFiProviderService: LiFiProviderService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityProviderService,
        { provide: LiFiProviderService, useValue: createMock<LiFiProviderService>() },
      ],
    }).compile()

    liquidityProviderService = module.get<LiquidityProviderService>(LiquidityProviderService)
    liFiProviderService = module.get<LiFiProviderService>(LiFiProviderService)
  })

  describe('getQuote', () => {
    it('should call liFiProvider.getQuote', async () => {
      const mockTokenIn = { chainId: 1 }
      const mockTokenOut = { chainId: 2 }
      const mockSwapAmount = 100
      const mockQuote = { amountIn: 100n, amountOut: 200n }

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(mockQuote as any)

      const result = await liquidityProviderService.getQuote(
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(liFiProviderService.getQuote).toHaveBeenCalledWith(
        mockTokenIn,
        mockTokenOut,
        mockSwapAmount,
      )
      expect(result).toEqual(mockQuote)
    })
  })

  describe('fallback', () => {
    it('should call liFiProvider.fallback', async () => {
      const mockTokenIn = { chainId: 1 }
      const mockTokenOut = { chainId: 2 }
      const mockSwapAmount = 100
      const mockQuote = { amountIn: 100n, amountOut: 200n }

      jest.spyOn(liFiProviderService, 'fallback').mockResolvedValue(mockQuote as any)

      const result = await liquidityProviderService.fallback(
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(liFiProviderService.fallback).toHaveBeenCalledWith(
        mockTokenIn,
        mockTokenOut,
        mockSwapAmount,
      )
      expect(result).toEqual(mockQuote)
    })
  })

  describe('execute', () => {
    it('should execute LiFi quote', async () => {
      const mockQuote = { strategy: 'LiFi', tokenIn: {}, tokenOut: {} }

      jest.spyOn(liFiProviderService, 'execute').mockResolvedValue(undefined as any)

      await liquidityProviderService.execute(mockQuote as any)

      expect(liFiProviderService.execute).toHaveBeenCalledWith(mockQuote)
    })

    it('should throw error for unsupported strategy', async () => {
      const mockQuote = { strategy: 'UnsupportedStrategy' }

      await expect(liquidityProviderService.execute(mockQuote as any)).rejects.toThrow(
        'Strategy not supported: UnsupportedStrategy',
      )
    })
  })
})
