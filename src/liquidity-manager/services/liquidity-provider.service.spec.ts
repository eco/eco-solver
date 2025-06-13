import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'

const walletAddr = '0xWalletAddress'

describe('LiquidityProviderService', () => {
  let liquidityProviderService: LiquidityProviderService
  let liFiProviderService: LiFiProviderService
  let cctpProviderService: CCTPProviderService
  let relayProviderService: RelayProviderService
  let stargateProviderService: StargateProviderService
  let warpRouteProviderService: WarpRouteProviderService
  let ecoConfigService: EcoConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityProviderService,
        { provide: LiFiProviderService, useValue: createMock<LiFiProviderService>() },
        { provide: CCTPProviderService, useValue: createMock<CCTPProviderService>() },
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
        { provide: RelayProviderService, useValue: createMock<RelayProviderService>() },
        { provide: StargateProviderService, useValue: createMock<StargateProviderService>() },
        { provide: WarpRouteProviderService, useValue: createMock<WarpRouteProviderService>() },
        {
          provide: EcoConfigService,
          useValue: {
            getLiquidityManager: jest.fn().mockReturnValue({ maxQuoteSlippage: 0.005 }),
          },
        },
      ],
    }).compile()

    liquidityProviderService = module.get<LiquidityProviderService>(LiquidityProviderService)
    liFiProviderService = module.get<LiFiProviderService>(LiFiProviderService)
    cctpProviderService = module.get<CCTPProviderService>(CCTPProviderService)
    relayProviderService = module.get<RelayProviderService>(RelayProviderService)
    stargateProviderService = module.get<StargateProviderService>(StargateProviderService)
    warpRouteProviderService = module.get<WarpRouteProviderService>(WarpRouteProviderService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
  })

  describe('getQuote', () => {
    it('should call liFiProvider.getQuote', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuote = [
        {
          amountIn: 100n,
          amountOut: 200n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.004, // 0.4% slippage - within limit
          strategy: 'LiFi',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(cctpProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(relayProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(stargateProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(mockQuote as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
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

    it('should filter out quotes exceeding maximum slippage', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.006, // 0.6% slippage - exceeds 0.5% limit
          strategy: 'LiFi',
        },
        {
          amountIn: 100n,
          amountOut: 195n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.003, // 0.3% slippage - within limit
          strategy: 'LiFi',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(mockQuotes as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue([])

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toHaveLength(1)
      expect(result[0].slippage).toBe(0.003)
    })

    it('should throw error if all quotes exceed maximum slippage', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.006, // 0.6% slippage - exceeds limit
          strategy: 'LiFi',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(mockQuotes as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue([])

      await expect(
        liquidityProviderService.getQuote(
          walletAddr,
          mockTokenIn as any,
          mockTokenOut as any,
          mockSwapAmount,
        ),
      ).rejects.toThrow('Unable to get quote for route')
    })
  })

  describe('fallback', () => {
    it('should call liFiProvider.fallback', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          slippage: 0.003, // 0.3% slippage - within limit
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
        },
      ]

      jest.spyOn(liFiProviderService, 'fallback').mockResolvedValue(mockQuotes as any)

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
      expect(result).toEqual(mockQuotes)
    })

    it('should throw error if fallback quote exceeds maximum slippage', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          slippage: 0.006, // 0.6% slippage - exceeds 0.5% limit
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
        },
      ]

      jest.spyOn(liFiProviderService, 'fallback').mockResolvedValue(mockQuotes as any)

      await expect(
        liquidityProviderService.fallback(mockTokenIn as any, mockTokenOut as any, mockSwapAmount),
      ).rejects.toThrow(/Fallback quote slippage .* exceeds maximum allowed 0.005/)
    })

    it('should throw error if compound slippage from multiple quotes exceeds maximum', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          slippage: 0.003, // 0.3% slippage
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
        },
        {
          amountIn: 200n,
          amountOut: 400n,
          slippage: 0.003, // 0.3% slippage
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
        },
      ]
      // Compound slippage: 1 - (0.997 * 0.997) = 0.005991 > 0.005

      jest.spyOn(liFiProviderService, 'fallback').mockResolvedValue(mockQuotes as any)

      await expect(
        liquidityProviderService.fallback(mockTokenIn as any, mockTokenOut as any, mockSwapAmount),
      ).rejects.toThrow(/Fallback quote slippage .* exceeds maximum allowed 0.005/)
    })
  })

  describe('execute', () => {
    it('should execute LiFi quote', async () => {
      const mockQuote = { strategy: 'LiFi', tokenIn: {}, tokenOut: {} }

      jest.spyOn(liFiProviderService, 'execute').mockResolvedValue(undefined as any)

      await liquidityProviderService.execute(walletAddr, mockQuote as any)

      expect(liFiProviderService.execute).toHaveBeenCalledWith(walletAddr, mockQuote)
    })

    it('should throw error for unsupported strategy', async () => {
      const mockQuote = { strategy: 'UnsupportedStrategy' }

      await expect(liquidityProviderService.execute(walletAddr, mockQuote as any)).rejects.toThrow(
        'Strategy not supported: UnsupportedStrategy',
      )
    })
  })
})
