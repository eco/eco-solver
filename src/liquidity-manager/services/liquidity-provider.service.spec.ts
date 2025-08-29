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
import { CCTPLiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import * as uuid from 'uuid' // import as a namespace so we can spyOn later
import { EcoAnalyticsService } from '@/analytics'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from './liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'
import { GatewayProviderService } from './liquidity-providers/Gateway/gateway-provider.service'
import { RebalanceQuoteRejectionRepository } from '@/liquidity-manager/repositories/rebalance-quote-rejection.repository'
import { RejectionReason } from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'

const walletAddr = '0xWalletAddress'

describe('LiquidityProviderService', () => {
  let liquidityProviderService: LiquidityProviderService
  let liFiProviderService: LiFiProviderService
  let cctpProviderService: CCTPProviderService
  let relayProviderService: RelayProviderService
  let stargateProviderService: StargateProviderService
  let warpRouteProviderService: WarpRouteProviderService
  let ecoConfigService: EcoConfigService
  let cctpLiFiProviderService: CCTPLiFiProviderService
  let squidProviderService: SquidProviderService
  let everclearProviderService: EverclearProviderService
  let rejectionRepository: RebalanceQuoteRejectionRepository

  beforeAll(() => {
    jest.spyOn(uuid, 'v4').mockReturnValue('1' as any)
  })

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
        { provide: CCTPLiFiProviderService, useValue: createMock<CCTPLiFiProviderService>() },
        { provide: SquidProviderService, useValue: createMock<SquidProviderService>() },
        { provide: CCTPV2ProviderService, useValue: createMock<CCTPV2ProviderService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
        { provide: EverclearProviderService, useValue: createMock<EverclearProviderService>() },
        { provide: GatewayProviderService, useValue: createMock<GatewayProviderService>() },
        {
          provide: RebalanceQuoteRejectionRepository,
          useValue: createMock<RebalanceQuoteRejectionRepository>(),
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
    cctpLiFiProviderService = module.get<CCTPLiFiProviderService>(CCTPLiFiProviderService)
    ecoConfigService = module.get<EcoConfigService>(EcoConfigService)
    squidProviderService = module.get<SquidProviderService>(SquidProviderService)
    everclearProviderService = module.get<EverclearProviderService>(EverclearProviderService)
    rejectionRepository = module.get<RebalanceQuoteRejectionRepository>(
      RebalanceQuoteRejectionRepository,
    )

    // Set up the mock for getLiquidityManager after getting the service
    const liquidityManagerConfigMock = {
      maxQuoteSlippage: 0.005,
      walletStrategies: {
        'crowd-liquidity-pool': ['CCTP'],
        'eco-wallet': ['LiFi', 'WarpRoute'],
      },
    }
    jest
      .spyOn(ecoConfigService, 'getLiquidityManager')
      .mockReturnValue(liquidityManagerConfigMock as any)

    // Reinitialize the config in the service
    liquidityProviderService['config'] = ecoConfigService.getLiquidityManager()
  })

  afterAll(() => {
    jest.restoreAllMocks() // optional clean-up
  })

  describe('getQuote', () => {
    it('should call liFiProvider.getQuote', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100
      const mockQuote = [
        {
          amountIn: '100',
          amountOut: '200',
          slippage: 0.003, // within 0.5% slippage limit
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          strategy: 'LiFi',
          context: {},
          id: '1',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(cctpProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(relayProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(stargateProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(cctpLiFiProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(squidProviderService, 'getQuote').mockResolvedValue(mockQuote as any)
      jest.spyOn(everclearProviderService, 'getQuote').mockResolvedValue(mockQuote as any)

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
        '1',
      )
      expect(result).toEqual(mockQuote)
    })

    it('should select the quote batch with the highest final output amount', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100

      const liFiQuotes = [
        {
          amountIn: 100n,
          amountOut: 190n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.002,
          strategy: 'LiFi',
          id: '1',
        },
      ]

      const warpRouteQuotes = [
        {
          amountIn: 100n,
          amountOut: 200n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.001,
          strategy: 'WarpRoute',
          id: '1',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(liFiQuotes as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(warpRouteQuotes as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual(warpRouteQuotes)
    })

    it('should throw error if no valid quotes are returned from any strategy', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100

      jest.spyOn(liFiProviderService, 'getQuote').mockRejectedValue(new Error('No route'))
      jest.spyOn(warpRouteProviderService, 'getQuote').mockRejectedValue(new Error('No route'))

      await expect(
        liquidityProviderService.getQuote(
          walletAddr,
          mockTokenIn as any,
          mockTokenOut as any,
          mockSwapAmount,
        ),
      ).rejects.toThrow('Unable to get quote for route')
    })

    it('should correctly handle multi-step quotes with compound slippage', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100

      // Multi-step quote with compound slippage just under the limit
      const multiStepQuotes = [
        {
          amountIn: 100n,
          amountOut: 99n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.0025, // 0.25% slippage
          strategy: 'WarpRoute',
          id: '1',
        },
        {
          amountIn: 99n,
          amountOut: 98n,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          slippage: 0.0025, // 0.25% slippage
          strategy: 'WarpRoute',
          id: '1',
        },
      ]
      // Total slippage: 1 - (0.9975 * 0.9975) = 0.00499375 < 0.005

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue([] as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(multiStepQuotes as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual(multiStepQuotes)
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

  describe('rejection persistence integration', () => {
    const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
    const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
    const mockSwapAmount = 100

    beforeEach(() => {
      jest.spyOn(rejectionRepository, 'create').mockResolvedValue({ response: {} as any })
    })

    it('should persist HIGH_SLIPPAGE rejection when quote exceeds maximum slippage', async () => {
      const mockQuoteWithHighSlippage = {
        amountIn: 100n,
        amountOut: 200n,
        slippage: 0.01, // 1% slippage > 0.5% max
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        id: '1',
        strategy: 'LiFi',
      }

      jest
        .spyOn(liFiProviderService, 'getQuote')
        .mockResolvedValue([mockQuoteWithHighSlippage] as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual([])
      expect(rejectionRepository.create).toHaveBeenCalledWith({
        rebalanceId: '1',
        strategy: 'LiFi',
        reason: RejectionReason.HIGH_SLIPPAGE,
        tokenIn: expect.any(Object),
        tokenOut: expect.any(Object),
        swapAmount: mockSwapAmount,
        details: expect.objectContaining({
          slippage: 0.01,
          maxQuoteSlippage: 0.005,
        }),
        walletAddress: walletAddr,
      })
    })

    it('should persist PROVIDER_ERROR rejection when strategy throws error', async () => {
      const mockError = new Error('Provider API failed')
      jest.spyOn(liFiProviderService, 'getQuote').mockRejectedValue(mockError)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual([])
      expect(rejectionRepository.create).toHaveBeenCalledWith({
        rebalanceId: '1',
        strategy: 'LiFi',
        reason: RejectionReason.PROVIDER_ERROR,
        tokenIn: expect.any(Object),
        tokenOut: expect.any(Object),
        swapAmount: mockSwapAmount,
        details: expect.objectContaining({
          error: 'Provider API failed',
          operation: 'strategy_quote',
        }),
        walletAddress: walletAddr,
      })
    })

    it('should persist fallback rejection when fallback quote has high slippage', async () => {
      const mockQuoteWithHighSlippage = {
        amountIn: 100n,
        amountOut: 200n,
        slippage: 0.01, // 1% slippage > 0.5% max
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
      }

      jest
        .spyOn(liFiProviderService, 'fallback')
        .mockResolvedValue([mockQuoteWithHighSlippage] as any)

      await expect(
        liquidityProviderService.fallback(
          mockTokenIn as any,
          mockTokenOut as any,
          mockSwapAmount,
          '1',
          walletAddr,
        ),
      ).rejects.toThrow('Fallback quote slippage')

      expect(rejectionRepository.create).toHaveBeenCalledWith({
        rebalanceId: '1',
        strategy: 'LiFi',
        reason: RejectionReason.HIGH_SLIPPAGE,
        tokenIn: expect.any(Object),
        tokenOut: expect.any(Object),
        swapAmount: mockSwapAmount,
        details: expect.objectContaining({
          slippage: 0.01,
          maxQuoteSlippage: 0.005,
          fallback: true,
        }),
        walletAddress: walletAddr,
      })
    })

    it('should continue operation even if rejection persistence fails', async () => {
      const mockQuoteWithHighSlippage = {
        amountIn: 100n,
        amountOut: 200n,
        slippage: 0.01, // 1% slippage > 0.5% max
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        id: '1',
        strategy: 'LiFi',
      }

      jest
        .spyOn(liFiProviderService, 'getQuote')
        .mockResolvedValue([mockQuoteWithHighSlippage] as any)
      jest
        .spyOn(rejectionRepository, 'create')
        .mockRejectedValue(new Error('Database connection failed'))

      // Should not throw despite persistence failure
      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual([])
      expect(rejectionRepository.create).toHaveBeenCalled()
    })
  })
})
