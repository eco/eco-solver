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
import { USDT0ProviderService } from './liquidity-providers/USDT0/usdt0-provider.service'
import { USDT0LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0-LiFi/usdt0-lifi-provider.service'
import { CCIPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-provider.service'
import { CCIPLiFiProviderService } from './liquidity-providers/CCIP-LiFi/ccip-lifi-provider.service'

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
  let cctpv2ProviderService: CCTPV2ProviderService
  let gatewayProviderService: GatewayProviderService
  let usdt0ProviderService: USDT0ProviderService
  let ccipProviderService: CCIPProviderService
  let ccipLiFiProviderService: CCIPLiFiProviderService
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
        {
          provide: USDT0ProviderService,
          useValue: createMock<USDT0ProviderService>(),
        },
        {
          provide: USDT0LiFiProviderService,
          useValue: createMock<USDT0LiFiProviderService>(),
        },
        {
          provide: CCIPProviderService,
          useValue: createMock<CCIPProviderService>(),
        },
        {
          provide: CCIPLiFiProviderService,
          useValue: createMock<CCIPLiFiProviderService>(),
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
    cctpv2ProviderService = module.get<CCTPV2ProviderService>(CCTPV2ProviderService)
    gatewayProviderService = module.get<GatewayProviderService>(GatewayProviderService)
    usdt0ProviderService = module.get<USDT0ProviderService>(USDT0ProviderService)
    ccipProviderService = module.get<CCIPProviderService>(CCIPProviderService)
    ccipLiFiProviderService = module.get<CCIPLiFiProviderService>(CCIPLiFiProviderService)
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

    // Stub isRouteAvailable to return true by default for all providers
    // This is required because getQuote now calls isRouteAvailable first
    jest.spyOn(liFiProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(cctpProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(relayProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(stargateProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(warpRouteProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(cctpLiFiProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(squidProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(everclearProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(cctpv2ProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(gatewayProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(usdt0ProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(ccipProviderService, 'isRouteAvailable').mockResolvedValue(true)
    jest.spyOn(ccipLiFiProviderService, 'isRouteAvailable').mockResolvedValue(true)
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

    it('selects the batch whose final step yields the highest amountOut, even with multi-step quotes', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }

      const liFiMultiStep = [
        {
          amountIn: 100n,
          amountOut: 120n,
          tokenIn: { ...mockTokenIn, balance: { decimals: 6 } },
          tokenOut: {
            chainId: 1,
            config: { address: '0xIntermediate' },
            balance: { decimals: 6 },
          },
          slippage: 0.001,
          strategy: 'LiFi',
          id: '1',
        },
        {
          amountIn: 120n,
          amountOut: 215n, // final leg delivers deficit token
          tokenIn: {
            chainId: 1,
            config: { address: '0xIntermediate' },
            balance: { decimals: 6 },
          },
          tokenOut: { ...mockTokenOut, balance: { decimals: 6 } },
          slippage: 0.001,
          strategy: 'LiFi',
          id: '1',
        },
      ]

      const warpRouteSingle = [
        {
          amountIn: 100n,
          amountOut: 230n,
          tokenIn: { ...mockTokenIn, balance: { decimals: 6 } },
          tokenOut: { ...mockTokenOut, balance: { decimals: 6 } },
          slippage: 0.001,
          strategy: 'WarpRoute',
          id: '1',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue(liFiMultiStep as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(warpRouteSingle as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        100,
      )

      expect(liFiProviderService.getQuote).toHaveBeenCalled()
      const expectedBestOut = warpRouteSingle[warpRouteSingle.length - 1].amountOut
      expect(result[result.length - 1].amountOut).toEqual(expectedBestOut)
    })

    it('returns empty array when swapAmount <= 0 or not finite and does not call providers', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 1, config: { address: '0xTokenOut' } }

      const spies = [
        jest.spyOn(liFiProviderService, 'getQuote'),
        jest.spyOn(warpRouteProviderService, 'getQuote'),
      ]

      await expect(
        liquidityProviderService.getQuote(walletAddr, mockTokenIn as any, mockTokenOut as any, 0),
      ).resolves.toEqual([])
      await expect(
        liquidityProviderService.getQuote(walletAddr, mockTokenIn as any, mockTokenOut as any, -1),
      ).resolves.toEqual([])
      await expect(
        liquidityProviderService.getQuote(
          walletAddr,
          mockTokenIn as any,
          mockTokenOut as any,
          Number.NaN,
        ),
      ).resolves.toEqual([])

      spies.forEach((s) => expect(s).not.toHaveBeenCalled())
    })

    it('uses eco-wallet strategies for normal wallets and calls both LiFi and WarpRoute', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100

      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue([] as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue([] as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual([])
      expect(liFiProviderService.getQuote).toHaveBeenCalled()
      expect(warpRouteProviderService.getQuote).toHaveBeenCalled()
    })

    it('uses crowd-liquidity-pool strategies for the pool wallet', async () => {
      const poolWallet = '0xPOOL'
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const mockSwapAmount = 100

      jest
        .spyOn((liquidityProviderService as any).crowdLiquidityService, 'getPoolAddress')
        .mockReturnValue(poolWallet)

      const cfg = {
        maxQuoteSlippage: 0.005,
        walletStrategies: {
          'crowd-liquidity-pool': ['CCTP'],
          'eco-wallet': ['LiFi', 'WarpRoute'],
        },
      }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(cfg as any)
      ;(liquidityProviderService as any).config = cfg as any

      const cctpQuotes = [
        {
          amountIn: 100n,
          amountOut: 100n,
          slippage: 0.001,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          strategy: 'CCTP',
          id: '1',
        },
      ]

      const cctpSpy = jest
        .spyOn(cctpProviderService, 'getQuote')
        .mockResolvedValue(cctpQuotes as any)
      const liFiSpy = jest.spyOn(liFiProviderService, 'getQuote')
      const warpSpy = jest.spyOn(warpRouteProviderService, 'getQuote')

      const result = await liquidityProviderService.getQuote(
        poolWallet,
        mockTokenIn as any,
        mockTokenOut as any,
        mockSwapAmount,
      )

      expect(result).toEqual(cctpQuotes)
      expect(cctpSpy).toHaveBeenCalled()
      expect(liFiSpy).not.toHaveBeenCalled()
      expect(warpSpy).not.toHaveBeenCalled()
    })

    it('throws when no strategies configured for wallet type', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const cfg = {
        maxQuoteSlippage: 0.005,
        walletStrategies: {
          'crowd-liquidity-pool': ['CCTP'],
          'eco-wallet': [],
        },
      }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(cfg as any)
      ;(liquidityProviderService as any).config = cfg as any

      await expect(
        liquidityProviderService.getQuote(walletAddr, mockTokenIn as any, mockTokenOut as any, 100),
      ).rejects.toThrow('No strategies configured for wallet type: eco-wallet')
    })

    it('returns [] when all strategies return empty arrays', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      jest.spyOn(liFiProviderService, 'getQuote').mockResolvedValue([] as any)
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue([] as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        100,
      )
      expect(result).toEqual([])
    })

    it('returns [] (not throw) when some strategies error and others are rejected due to slippage', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }
      const highSlipQuote = [
        {
          amountIn: 100n,
          amountOut: 90n,
          slippage: 0.01,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          strategy: 'WarpRoute',
          id: '1',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockRejectedValue(new Error('liFi error'))
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(highSlipQuote as any)
      jest.spyOn(rejectionRepository, 'create').mockResolvedValue({} as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        100,
      )

      expect(result).toEqual([])
      expect(rejectionRepository.create).toHaveBeenCalled()
    })

    it('records compounded slippage details when rejecting a multi-step quote', async () => {
      const mockTokenIn = { chainId: 1, config: { address: '0xTokenIn' } }
      const mockTokenOut = { chainId: 2, config: { address: '0xTokenOut' } }

      const overSlippageQuotes = [
        {
          amountIn: 100n,
          amountOut: 98n,
          slippage: 0.003,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          strategy: 'WarpRoute',
          id: '1',
        },
        {
          amountIn: 98n,
          amountOut: 95n,
          slippage: 0.003,
          tokenIn: mockTokenIn,
          tokenOut: mockTokenOut,
          strategy: 'WarpRoute',
          id: '1',
        },
      ]

      jest.spyOn(liFiProviderService, 'getQuote').mockRejectedValue(new Error('liFi error'))
      jest.spyOn(warpRouteProviderService, 'getQuote').mockResolvedValue(overSlippageQuotes as any)
      const rejectionSpy = jest.spyOn(rejectionRepository, 'create').mockResolvedValue({} as any)

      const result = await liquidityProviderService.getQuote(
        walletAddr,
        mockTokenIn as any,
        mockTokenOut as any,
        100,
      )

      expect(result).toEqual([])
      expect(rejectionSpy).toHaveBeenCalled()
      // Find the HIGH_SLIPPAGE rejection entry (since a PROVIDER_ERROR may be logged first)
      const payloads = rejectionSpy.mock.calls.map((c) => c[0])
      const highSlip = payloads.find((p: any) => p.reason === RejectionReason.HIGH_SLIPPAGE)
      expect(highSlip).toBeDefined()
      const hs: any = highSlip as any
      expect(hs.details).toBeDefined()
      expect(Number(hs.details.slippage ?? 0)).toBeGreaterThanOrEqual(0)
      expect(hs.details.quotes ?? []).toHaveLength(2)
    })

    it('invokes configured strategies beyond LiFi/WarpRoute in priority order', async () => {
      const cfg = {
        maxQuoteSlippage: 0.01,
        walletStrategies: {
          'crowd-liquidity-pool': ['CCTP'],
          'eco-wallet': ['Gateway', 'USDT0'],
        },
      }
      jest.spyOn(ecoConfigService, 'getLiquidityManager').mockReturnValue(cfg as any)
      ;(liquidityProviderService as any).config = cfg as any

      const gatewayQuote = [
        {
          amountIn: 100n,
          amountOut: 99n,
          slippage: 0.001,
          tokenIn: { chainId: 1, config: { address: '0xTokenIn' } },
          tokenOut: { chainId: 2, config: { address: '0xTokenOut' } },
          strategy: 'Gateway',
        },
      ]
      jest.spyOn(gatewayProviderService, 'getQuote').mockResolvedValue(gatewayQuote as any)
      jest.spyOn(usdt0ProviderService, 'getQuote').mockResolvedValue([] as any)

      await liquidityProviderService.getQuote(
        walletAddr,
        { chainId: 1, config: { address: '0xTokenIn' } } as any,
        { chainId: 2, config: { address: '0xTokenOut' } } as any,
        100,
      )

      expect(gatewayProviderService.getQuote).toHaveBeenCalledTimes(1)
      expect(usdt0ProviderService.getQuote).toHaveBeenCalledTimes(1)
    })
  })

  // Fallback removed: no tests for fallback

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

    it('dispatches execute to the correct provider for all strategies', async () => {
      const strategies = [
        { name: 'CCTP', service: cctpProviderService },
        { name: 'WarpRoute', service: warpRouteProviderService },
        { name: 'Relay', service: relayProviderService },
        { name: 'Stargate', service: stargateProviderService },
        { name: 'CCTPLiFi', service: cctpLiFiProviderService },
        { name: 'Squid', service: squidProviderService },
        { name: 'CCTPV2', service: cctpv2ProviderService },
        { name: 'Everclear', service: everclearProviderService },
        { name: 'Gateway', service: gatewayProviderService },
        { name: 'USDT0', service: usdt0ProviderService },
      ] as const

      for (const s of strategies) {
        const quote = { strategy: s.name, tokenIn: {}, tokenOut: {}, id: '1' } as any
        const spy = jest.spyOn(s.service as any, 'execute').mockResolvedValue(undefined)
        await liquidityProviderService.execute(walletAddr, quote)
        expect(spy).toHaveBeenCalledWith(walletAddr, quote)
      }
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

    // Fallback removed: skip fallback-specific rejection tests

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
        .mockResolvedValue({ error: new Error('Database connection failed') })

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
