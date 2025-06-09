import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import {
  StargateProviderService
} from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'

const walletAddr = '0xWalletAddress'

describe('LiquidityProviderService', () => {
  let liquidityProviderService: LiquidityProviderService
  let liFiProviderService: LiFiProviderService
  let cctpProviderService: CCTPProviderService
  let relayProviderService: RelayProviderService
  let stargateProviderService: StargateProviderService
  let warpRouteProviderService: WarpRouteProviderService

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
      ],
    }).compile()

    liquidityProviderService = module.get<LiquidityProviderService>(LiquidityProviderService)
    liFiProviderService = module.get<LiFiProviderService>(LiFiProviderService)
    cctpProviderService = module.get<CCTPProviderService>(CCTPProviderService)
    relayProviderService = module.get<RelayProviderService>(RelayProviderService)
    stargateProviderService = module.get<StargateProviderService>(StargateProviderService)
    warpRouteProviderService = module.get<WarpRouteProviderService>(WarpRouteProviderService)
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
