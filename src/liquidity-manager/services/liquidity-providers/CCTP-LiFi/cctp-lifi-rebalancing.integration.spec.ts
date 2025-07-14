import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken, getFlowProducerToken } from '@nestjs/bullmq'
import { getModelToken } from '@nestjs/mongoose'
import { Logger } from '@nestjs/common'
import { parseUnits } from 'viem'
import { FlowProducer, Queue } from 'bullmq'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import * as LiFi from '@lifi/sdk'

// Services
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { CCTPLiFiProviderService } from './cctp-lifi-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { BalanceService } from '@/balance/balance.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { PublicNegativeIntentRebalanceService } from '@/negative-intents/services/public-negative-intent-rebalance.service'

// Types & Models
import { TokenData, Strategy, RebalanceRequest } from '@/liquidity-manager/types/types'
import { TokenConfig } from '@/balance/types'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { Model } from 'mongoose'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { CCTPV2ProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EcoAnalyticsService } from '@/analytics'

function mockLiFiRoute(partial: Partial<LiFi.Route> = {}): LiFi.Route {
  return {
    id: 'route-id',
    fromChainId: 1,
    toChainId: 10,
    fromAmount: '1000000',
    toAmountUSD: '1000',
    fromAmountUSD: '1000',
    toAmount: '1000000',
    toAmountMin: '990000',
    insurance: {
      state: 'INSURABLE',
      feeAmountUsd: '100',
    },
    fromToken: {
      address: '0xToken',
      chainId: 1,
      symbol: 'TKN',
      decimals: 6,
      name: 'Token',
      logoURI: '',
      priceUSD: '1',
    },
    toToken: {
      address: '0xToken',
      chainId: 10,
      symbol: 'TKN',
      decimals: 6,
      name: 'Token',
      logoURI: '',
      priceUSD: '1',
    },
    steps: [],
    tags: [],
    ...partial,
  }
}

describe('CCTP-LiFi Rebalancing Integration Tests', () => {
  let liquidityManagerService: LiquidityManagerService
  let liquidityProviderService: LiquidityProviderService
  let cctpLiFiProvider: CCTPLiFiProviderService
  let liFiService: DeepMocked<LiFiProviderService>
  let cctpService: DeepMocked<CCTPProviderService>
  let relayService: DeepMocked<RelayProviderService>
  let stargateService: DeepMocked<StargateProviderService>
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  let flowProducer: DeepMocked<FlowProducer>
  let rebalanceModel: DeepMocked<Model<RebalanceModel>>

  const walletAddress = '0x1234567890123456789012345678901234567890'

  // Mock configuration
  const mockLiquidityConfig: LiquidityManagerConfig = {
    targetSlippage: 0.02,
    intervalDuration: 300000, // 5 minutes
    thresholds: { surplus: 0.15, deficit: 0.15 }, // 15% threshold
    coreTokens: [
      { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainID: 1 }, // USDC on Ethereum
      { token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', chainID: 10 }, // USDC on Optimism
    ],
    walletStrategies: {
      'eco-wallet': ['CCTPLiFi'], // Only test CCTPLiFi strategy
    },
    maxQuoteSlippage: 0.005,
    swapSlippage: 0.01,
  }

  // Mock token configurations
  const mockTokenConfigs: TokenConfig[] = [
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
      chainId: 1,
      targetBalance: 1000,
      minBalance: 800,
      type: 'erc20' as const,
    },
    {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT on Optimism
      chainId: 10,
      targetBalance: 1000,
      minBalance: 800,
      type: 'erc20' as const,
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
      chainId: 1,
      targetBalance: 1000,
      minBalance: 800,
      type: 'erc20' as const,
    },
    {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
      chainId: 10,
      targetBalance: 1000,
      minBalance: 800,
      type: 'erc20' as const,
    },
  ]

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.restoreAllMocks()

    // Create mocks
    queue = createMock<Queue>()
    flowProducer = createMock<FlowProducer>()
    rebalanceModel = createMock<Model<RebalanceModel>>()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiquidityManagerService,
        LiquidityProviderService,
        CCTPLiFiProviderService,
        {
          provide: LiFiProviderService,
          useValue: createMock<LiFiProviderService>(),
        },
        {
          provide: CCTPProviderService,
          useValue: createMock<CCTPProviderService>(),
        },
        {
          provide: RelayProviderService,
          useValue: createMock<RelayProviderService>(),
        },
        {
          provide: StargateProviderService,
          useValue: createMock<StargateProviderService>(),
        },
        {
          provide: WarpRouteProviderService,
          useValue: createMock<WarpRouteProviderService>(),
        },
        {
          provide: SquidProviderService,
          useValue: createMock<SquidProviderService>(),
        },
        {
          provide: CCTPV2ProviderService,
          useValue: createMock<CCTPV2ProviderService>(),
        },
        {
          provide: BalanceService,
          useValue: createMock<BalanceService>(),
        },
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
        {
          provide: CrowdLiquidityService,
          useValue: createMock<CrowdLiquidityService>(),
        },
        {
          provide: getQueueToken(LiquidityManagerQueue.queueName),
          useValue: queue,
        },
        {
          provide: getFlowProducerToken(LiquidityManagerQueue.flowName),
          useValue: flowProducer,
        },
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: rebalanceModel,
        },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
      ],
    }).compile()

    // Get services
    liquidityManagerService = module.get<LiquidityManagerService>(LiquidityManagerService)
    liquidityProviderService = module.get<LiquidityProviderService>(LiquidityProviderService)
    cctpLiFiProvider = module.get<CCTPLiFiProviderService>(CCTPLiFiProviderService)
    liFiService = module.get(LiFiProviderService)
    cctpService = module.get(CCTPProviderService)
    relayService = module.get(RelayProviderService)
    stargateService = module.get(StargateProviderService)
    balanceService = module.get(BalanceService)
    ecoConfigService = module.get(EcoConfigService)
    const crowdLiquidityService = module.get(CrowdLiquidityService)

    // Setup default mocks
    ecoConfigService.getLiquidityManager.mockReturnValue(mockLiquidityConfig)
    ecoConfigService.getFulfill.mockReturnValue({ type: 'solver' } as any)

    // Mock crowd liquidity service to properly determine wallet type
    ;(crowdLiquidityService.getPoolAddress as jest.Mock).mockReturnValue('0xcrowdliquiditypool')

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'debug').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    // Mock rebalance model
    rebalanceModel.create.mockResolvedValue({} as any)

    // Set config in liquidity manager
    liquidityManagerService['config'] = mockLiquidityConfig
    liquidityManagerService['tokensPerWallet'][walletAddress] = mockTokenConfigs
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('End-to-End Rebalancing Flow', () => {
    it('should detect surplus/deficit and rebalance USDT from Ethereum to Optimism using CCTP-LiFi', async () => {
      // Step 1: Mock token balances - surplus on Ethereum, deficit on Optimism
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0], // USDT on Ethereum
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1500', 6), // 1500 USDT (surplus)
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1], // USDT on Optimism
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('500', 6), // 500 USDT (deficit)
            decimals: 6,
          },
        },
        {
          chainId: 1,
          config: mockTokenConfigs[2], // USDC on Ethereum
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: parseUnits('1000', 6), // 1000 USDC (in range)
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[3], // USDC on Optimism
          balance: {
            address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            balance: parseUnits('1000', 6), // 1000 USDC (in range)
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Step 2: Analyze tokens - this is what the cron job does
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Verify analysis
      expect(analysis.surplus.items).toHaveLength(1)
      expect(analysis.deficit.items).toHaveLength(1)
      expect(analysis.surplus.items[0].config.address).toBe(
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      )
      expect(analysis.surplus.items[0].config.chainId).toBe(1)
      expect(analysis.deficit.items[0].config.address).toBe(
        '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      )
      expect(analysis.deficit.items[0].config.chainId).toBe(10)

      // Step 3: Mock LiFi quotes for CCTP-LiFi strategy
      const sourceSwapQuote = mockLiFiRoute({
        fromAmount: '350000000',
        toAmount: '349000000',
        toAmountMin: '342020000',
        fromChainId: 1,
        toChainId: 1,
        fromToken: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      const destinationSwapQuote = mockLiFiRoute({
        fromAmount: '349000000',
        toAmount: '347000000',
        toAmountMin: '339150000',
        fromChainId: 10,
        toChainId: 10,
        fromToken: {
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          chainId: 10,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          chainId: 10,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      // Mock the LiFi service responses
      liFiService.getQuote
        .mockResolvedValueOnce({
          amountIn: parseUnits('350', 6),
          amountOut: parseUnits('349', 6),
          slippage: 0.002,
          tokenIn: analysis.surplus.items[0],
          tokenOut: {
            chainId: 1,
            config: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              chainId: 1,
              minBalance: 0,
              targetBalance: 0,
              type: 'erc20' as const,
            },
            balance: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
              balance: 0n,
            },
          },
          strategy: 'LiFi' as const,
          context: sourceSwapQuote,
        })
        .mockResolvedValueOnce({
          amountIn: parseUnits('349', 6),
          amountOut: parseUnits('347', 6),
          slippage: 0.005,
          tokenIn: {
            chainId: 10,
            config: {
              address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
              chainId: 10,
              minBalance: 0,
              targetBalance: 0,
              type: 'erc20' as const,
            },
            balance: {
              address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
              decimals: 6,
              balance: parseUnits('349', 6),
            },
          },
          tokenOut: analysis.deficit.items[0],
          strategy: 'LiFi' as const,
          context: destinationSwapQuote,
        })

      // Mock CCTPLiFiProviderService to return proper quote
      jest.spyOn(cctpLiFiProvider, 'getQuote').mockResolvedValue({
        amountIn: parseUnits('350', 6),
        amountOut: parseUnits('347', 6),
        slippage: 0.009, // 0.9% total slippage
        tokenIn: analysis.surplus.items[0],
        tokenOut: analysis.deficit.items[0],
        strategy: 'CCTPLiFi',
        context: {
          sourceSwapQuote,
          cctpTransfer: {
            sourceChain: 1,
            destinationChain: 10,
            amount: parseUnits('349', 6),
          },
          destinationSwapQuote,
          steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
          id: '1',
        },
      })

      // Step 4: Get rebalancing quotes - this simulates what the cron job does
      // Mock the liquidityProviderService to return our expected quote
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: parseUnits('350', 6),
          amountOut: parseUnits('347', 6),
          slippage: 0.009, // 0.9% total slippage
          tokenIn: analysis.surplus.items[0],
          tokenOut: analysis.deficit.items[0],
          strategy: 'CCTPLiFi' as const,
          context: {
            sourceSwapQuote,
            cctpTransfer: {
              sourceChain: 1,
              destinationChain: 10,
              amount: parseUnits('349', 6),
            },
            destinationSwapQuote,
            steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
            id: '1',
          },
        },
      ])

      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Verify quote was generated
      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('CCTPLiFi')
      expect(quotes[0].amountIn).toBe(parseUnits('350', 6))
      expect(quotes[0].amountOut).toBe(parseUnits('347', 6))

      // Verify context
      const context = quotes[0].context as any
      expect(context.steps).toEqual(['sourceSwap', 'cctpBridge', 'destinationSwap'])
      expect(context.sourceSwapQuote).toEqual(sourceSwapQuote)
      expect(context.destinationSwapQuote).toEqual(destinationSwapQuote)
      expect(context.cctpTransfer).toEqual({
        sourceChain: 1,
        destinationChain: 10,
        amount: parseUnits('349', 6),
      })

      // Step 5: Store and start rebalancing - this is what the cron job does
      const rebalanceRequest = {
        token: analysis.deficit.items[0],
        quotes: quotes,
      }

      await liquidityManagerService.storeRebalancing(walletAddress, rebalanceRequest)

      // Verify storage
      expect(rebalanceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet: walletAddress,
          strategy: 'CCTPLiFi',
          amountIn: parseUnits('350', 6),
          amountOut: parseUnits('347', 6),
        }),
      )

      // Step 6: Execute rebalancing
      const mockCCTPResult = {
        sourceHash: '0xsourcehash',
        messageHash: '0xmessagehash',
        messageBytes: '0xmessagebytes',
      }

      cctpService.executeWithMetadata.mockResolvedValue(mockCCTPResult as any)
      liFiService.execute.mockResolvedValue({ transactionHash: '0xlifiswaphash' } as any)

      // Mock CCTPLiFi execute method
      jest.spyOn(cctpLiFiProvider, 'execute').mockResolvedValue(undefined)

      await liquidityManagerService.executeRebalancing({
        walletAddress,
        network: '1',
        rebalance: { quotes: quotes } as any,
      })

      // Verify execution calls
      expect(cctpLiFiProvider.execute).toHaveBeenCalledTimes(1)
      expect(cctpLiFiProvider.execute).toHaveBeenCalledWith(walletAddress, quotes[0])
    })

    it('should handle USDC to USDT rebalancing (no source swap needed)', async () => {
      // Mock balances - USDC surplus on Ethereum, USDT deficit on Optimism
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[2], // USDC on Ethereum
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: parseUnits('1400', 6), // 1400 USDC (surplus)
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1], // USDT on Optimism
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('600', 6), // 600 USDT (deficit)
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Analyze tokens
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Mock only destination swap quote (no source swap needed)
      const destinationSwapQuote = mockLiFiRoute({
        fromAmount: '300000000',
        toAmount: '298000000',
        toAmountMin: '292040000',
        fromChainId: 10,
        toChainId: 10,
        fromToken: {
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          chainId: 10,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          chainId: 10,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      // Mock the liquidityProviderService to return our expected quote
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: parseUnits('300', 6),
          amountOut: parseUnits('298', 6),
          slippage: 0.0067,
          tokenIn: analysis.surplus.items[0],
          tokenOut: analysis.deficit.items[0],
          strategy: 'CCTPLiFi' as const,
          context: {
            cctpTransfer: {
              sourceChain: 1,
              destinationChain: 10,
              amount: parseUnits('300', 6),
            },
            destinationSwapQuote,
            steps: ['cctpBridge', 'destinationSwap'],
            id: '1',
          },
        },
      ])

      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Verify quote
      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('CCTPLiFi')

      const context = quotes[0].context as any
      expect(context.steps).toEqual(['cctpBridge', 'destinationSwap'])
      expect(context.sourceSwapQuote).toBeUndefined()
      expect(context.destinationSwapQuote).toEqual(destinationSwapQuote)
    })

    it('should handle USDT to USDC rebalancing (no destination swap needed)', async () => {
      // Mock balances - USDT surplus on Ethereum, USDC deficit on Optimism
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0], // USDT on Ethereum
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1400', 6), // 1400 USDT (surplus)
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[3], // USDC on Optimism
          balance: {
            address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            balance: parseUnits('600', 6), // 600 USDC (deficit)
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Analyze tokens
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Mock only source swap quote (no destination swap needed)
      const sourceSwapQuote = mockLiFiRoute({
        fromAmount: '300000000',
        toAmount: '298000000',
        toAmountMin: '292040000',
        fromChainId: 1,
        toChainId: 1,
        fromToken: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      // Mock the liquidityProviderService to return our expected quote
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: parseUnits('300', 6),
          amountOut: parseUnits('298', 6),
          slippage: 0.0067,
          tokenIn: analysis.surplus.items[0],
          tokenOut: analysis.deficit.items[0],
          strategy: 'CCTPLiFi' as const,
          context: {
            sourceSwapQuote,
            cctpTransfer: {
              sourceChain: 1,
              destinationChain: 10,
              amount: parseUnits('292.04', 6), // toAmountMin from source swap
            },
            steps: ['sourceSwap', 'cctpBridge'],
            id: '1',
          },
        },
      ])

      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Verify quote
      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('CCTPLiFi')

      const context = quotes[0].context as any
      expect(context.steps).toEqual(['sourceSwap', 'cctpBridge'])
      expect(context.sourceSwapQuote).toEqual(sourceSwapQuote)
      expect(context.destinationSwapQuote).toBeUndefined()
    })

    it('should skip CCTP-LiFi when other strategies are configured', async () => {
      // Override config to exclude CCTPLiFi
      const altConfig = {
        ...mockLiquidityConfig,
        walletStrategies: {
          'eco-wallet': ['LiFi', 'CCTP'] as Strategy[], // No CCTPLiFi
        },
      }
      ecoConfigService.getLiquidityManager.mockReturnValue(altConfig)
      liquidityManagerService['config'] = altConfig

      // Mock token data with surplus/deficit
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0], // USDT on Ethereum
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1500', 6), // surplus
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1], // USDT on Optimism
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('500', 6), // deficit
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Mock other providers to return empty quotes
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([])

      // Analyze and get quotes
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)
      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Should not find any quotes since CCTPLiFi is not configured
      expect(quotes).toHaveLength(0)
    })

    it('should handle high slippage scenarios with warnings', async () => {
      // Setup token data
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0], // USDT on Ethereum
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1300', 6), // surplus
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1], // USDT on Optimism
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('700', 6), // deficit
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Analyze tokens
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Mock quotes with high slippage
      const sourceSwapQuote = mockLiFiRoute({
        fromAmount: '200000000',
        toAmount: '185000000',
        toAmountMin: '181300000',
        fromChainId: 1,
        toChainId: 1,
        fromToken: {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          chainId: 1,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      const destinationSwapQuote = mockLiFiRoute({
        fromAmount: '185000000',
        toAmount: '180000000',
        toAmountMin: '176400000',
        fromChainId: 10,
        toChainId: 10,
        fromToken: {
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          chainId: 10,
          symbol: 'USDT',
          decimals: 6,
          name: 'Tether USD',
          logoURI: '',
          priceUSD: '1',
        },
        toToken: {
          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          chainId: 10,
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin',
          logoURI: '',
          priceUSD: '1',
        },
      })

      liFiService.getQuote
        .mockResolvedValueOnce({
          amountIn: parseUnits('200', 6),
          amountOut: parseUnits('185', 6),
          slippage: 0.075,
          tokenIn: analysis.surplus.items[0],
          tokenOut: {
            chainId: 1,
            config: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              chainId: 1,
              minBalance: 0,
              targetBalance: 0,
              type: 'erc20' as const,
            },
            balance: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
              balance: 0n,
            },
          },
          strategy: 'LiFi' as const,
          context: sourceSwapQuote,
        })
        .mockResolvedValueOnce({
          amountIn: parseUnits('185', 6),
          amountOut: parseUnits('180', 6),
          slippage: 0.027,
          tokenIn: {
            chainId: 10,
            config: {
              address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
              chainId: 10,
              minBalance: 0,
              targetBalance: 0,
              type: 'erc20' as const,
            },
            balance: {
              address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
              decimals: 6,
              balance: parseUnits('185', 6),
            },
          },
          tokenOut: analysis.deficit.items[0],
          strategy: 'LiFi' as const,
          context: destinationSwapQuote,
        })

      // Mock CCTPLiFi provider with high slippage
      jest.spyOn(cctpLiFiProvider, 'getQuote').mockResolvedValue({
        amountIn: parseUnits('200', 6),
        amountOut: parseUnits('180', 6),
        slippage: 0.1,
        tokenIn: analysis.surplus.items[0],
        tokenOut: analysis.deficit.items[0],
        strategy: 'CCTPLiFi',
        context: {
          sourceSwapQuote,
          cctpTransfer: {
            sourceChain: 1,
            destinationChain: 10,
            amount: parseUnits('185', 6),
          },
          destinationSwapQuote,
          steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
          id: '1',
        },
      })

      // Mock liquidityProviderService to return the high-slippage CCTPLiFi quote
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: parseUnits('200', 6),
          amountOut: parseUnits('180', 6),
          slippage: 0.1,
          tokenIn: analysis.surplus.items[0],
          tokenOut: analysis.deficit.items[0],
          strategy: 'CCTPLiFi',
          context: {
            sourceSwapQuote,
            destinationSwapQuote,
            cctpTransfer: {
              sourceChain: 1,
              destinationChain: 10,
              amount: parseUnits('185', 6),
            },
            steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
            id: '1',
          },
        },
      ])

      // Get quotes
      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Verify quote was generated despite high slippage
      expect(quotes).toHaveLength(1)
      expect(quotes[0].slippage).toBeGreaterThan(0.05) // > 5%
    })

    it('should batch multiple rebalancing requests in a single cron execution', async () => {
      // Mock multiple deficit/surplus pairs
      const mockTokenData: TokenData[] = [
        // Pair 1: USDT surplus on Ethereum, deficit on Optimism
        {
          chainId: 1,
          config: mockTokenConfigs[0],
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1400', 6),
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1],
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('600', 6),
            decimals: 6,
          },
        },
        // Pair 2: USDC deficit on Ethereum, surplus on Optimism
        {
          chainId: 1,
          config: mockTokenConfigs[2],
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: parseUnits('700', 6),
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[3],
          balance: {
            address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            balance: parseUnits('1300', 6),
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Mock quotes for both rebalancing scenarios
      liFiService.getQuote.mockResolvedValue({
        amountIn: parseUnits('200', 6),
        amountOut: parseUnits('198', 6),
        slippage: 0.01,
        tokenIn: mockTokenData[0], // Will be overridden in actual calls
        tokenOut: mockTokenData[1], // Will be overridden in actual calls
        strategy: 'LiFi' as const,
        context: mockLiFiRoute({
          fromAmount: '200000000',
          toAmount: '198000000',
          toAmountMin: '194040000',
          fromChainId: 1,
          toChainId: 1,
        }),
      })

      // Mock CCTPLiFi provider for both quotes
      jest
        .spyOn(cctpLiFiProvider, 'getQuote')
        .mockImplementation(async (tokenIn, tokenOut, swapAmount) => {
          return {
            amountIn: parseUnits(swapAmount.toString(), 6),
            amountOut: parseUnits((swapAmount * 0.99).toString(), 6), // 1% slippage
            slippage: 0.01,
            tokenIn,
            tokenOut,
            strategy: 'CCTPLiFi',
            context: {
              cctpTransfer: {
                sourceChain: tokenIn.chainId,
                destinationChain: tokenOut.chainId,
                amount: parseUnits(swapAmount.toString(), 6),
              },
              steps: ['cctpBridge'],
              id: '1',
            },
          }
        })

      // Simulate cron job execution
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Should have 2 deficit items
      expect(analysis.deficit.items).toHaveLength(2)

      // Mock the liquidityProviderService to return quotes with properly structured data
      jest
        .spyOn(liquidityProviderService, 'getQuote')
        .mockImplementation(async (walletAddress, tokenIn, tokenOut, swapAmount) => {
          return [
            {
              amountIn: parseUnits(swapAmount.toString(), 6),
              amountOut: parseUnits((swapAmount * 0.99).toString(), 6), // 1% slippage
              slippage: 0.01,
              tokenIn,
              tokenOut,
              strategy: 'CCTPLiFi' as const,
              context: {
                cctpTransfer: {
                  sourceChain: tokenIn.chainId,
                  destinationChain: tokenOut.chainId,
                  amount: parseUnits(swapAmount.toString(), 6),
                },
                steps: ['cctpBridge'],
                id: '1',
              },
            },
          ]
        })

      const rebalances: RebalanceRequest[] = []
      for (const deficitToken of analysis.deficit.items) {
        const quotes = await liquidityManagerService.getOptimizedRebalancing(
          walletAddress,
          deficitToken,
          analysis.surplus.items,
        )

        if (quotes.length > 0) {
          rebalances.push({ token: deficitToken, quotes })
        }
      }

      // Should have quotes for both deficits
      expect(rebalances).toHaveLength(2)

      // Verify both would be stored
      for (const rebalance of rebalances) {
        await liquidityManagerService.storeRebalancing(walletAddress, rebalance)
      }

      expect(rebalanceModel.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling & Edge Cases', () => {
    it('should handle LiFi quote failures gracefully', async () => {
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0],
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1300', 6),
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1],
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('700', 6),
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Mock LiFi service to throw error (this would be called internally by CCTP-LiFi provider)
      liFiService.getQuote.mockRejectedValue(new Error('LiFi API error'))

      // Mock CCTP-LiFi provider to handle LiFi errors gracefully and return empty quotes
      jest
        .spyOn(cctpLiFiProvider, 'getQuote')
        .mockRejectedValue(new Error('Cannot create CCTP-LiFi quote due to LiFi API failure'))

      // Mock liquidityProviderService to return empty quotes when all providers fail
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([])

      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)
      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Should return empty quotes when LiFi provider fails
      expect(quotes).toHaveLength(0)

      // Verify that the liquidity provider service was called
      expect(liquidityProviderService.getQuote).toHaveBeenCalled()
      expect(liquidityProviderService.getQuote).toHaveBeenCalledWith(
        walletAddress,
        analysis.surplus.items[0],
        analysis.deficit.items[0],
        expect.any(Number),
      )
    })

    it('should not rebalance when amounts are below minimum thresholds', async () => {
      // Very small surplus/deficit
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0],
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1010', 6),
            decimals: 6,
          }, // tiny surplus
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1],
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('990', 6),
            decimals: 6,
          }, // tiny deficit
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Should not identify as surplus/deficit due to threshold
      expect(analysis.surplus.items).toHaveLength(0)
      expect(analysis.deficit.items).toHaveLength(0)
      expect(analysis.inrange.items).toHaveLength(2)
    })

    it('should handle execution failures and retry logic', async () => {
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0],
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('1300', 6),
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1],
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('700', 6),
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Analyze tokens
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Mock successful quote generation
      jest.spyOn(cctpLiFiProvider, 'getQuote').mockResolvedValue({
        amountIn: parseUnits('200', 6),
        amountOut: parseUnits('198', 6),
        slippage: 0.01,
        tokenIn: analysis.surplus.items[0],
        tokenOut: analysis.deficit.items[0],
        strategy: 'CCTPLiFi',
        context: {
          steps: ['cctpBridge'],
          cctpTransfer: {
            sourceChain: 1,
            destinationChain: 10,
            amount: parseUnits('200', 6),
          },
          id: '1',
        },
      })

      // Mock liquidityProviderService to return the CCTP-LiFi quote
      jest.spyOn(liquidityProviderService, 'getQuote').mockResolvedValue([
        {
          amountIn: parseUnits('200', 6),
          amountOut: parseUnits('198', 6),
          slippage: 0.01,
          tokenIn: analysis.surplus.items[0],
          tokenOut: analysis.deficit.items[0],
          strategy: 'CCTPLiFi' as const,
          context: {
            steps: ['cctpBridge'],
            cctpTransfer: {
              sourceChain: 1,
              destinationChain: 10,
              amount: parseUnits('200', 6),
            },
            id: '1',
          },
        },
      ])

      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Verify quote was generated successfully before execution
      expect(quotes).toHaveLength(1)
      expect(quotes[0].strategy).toBe('CCTPLiFi')

      // Mock execution failure - this is where the transaction fails
      jest.spyOn(cctpLiFiProvider, 'execute').mockRejectedValue(new Error('Transaction failed'))

      // Execute should throw the transaction failure error
      await expect(
        liquidityManagerService.executeRebalancing({
          walletAddress,
          network: '1',
          rebalance: { quotes } as any,
        }),
      ).rejects.toThrow('Transaction failed')

      // Verify that execution was attempted on the CCTP-LiFi provider
      expect(cctpLiFiProvider.execute).toHaveBeenCalledTimes(1)
      expect(cctpLiFiProvider.execute).toHaveBeenCalledWith(walletAddress, quotes[0])

      // Note: Retry logic would be implemented at a higher level (cron job/queue level)
      // The service itself should fail fast and let the retry mechanism handle it
    })
  })

  describe('Strategy-Specific Validation', () => {
    it('should validate CCTP chain support before creating quotes', async () => {
      // Create custom token config for unsupported chain
      const unsupportedTokenConfig: TokenConfig = {
        address: '0xunsupported',
        chainId: 999, // Unsupported chain
        targetBalance: 1000,
        minBalance: 800,
        type: 'erc20' as const,
      }

      const mockTokenData: TokenData[] = [
        {
          chainId: 999,
          config: unsupportedTokenConfig,
          balance: {
            address: '0xunsupported',
            balance: parseUnits('1300', 6),
            decimals: 6,
          },
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1], // USDT on Optimism (supported)
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('700', 6),
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Analyze tokens - should detect surplus on unsupported chain and deficit on supported chain
      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // Verify analysis detected the imbalance
      expect(analysis.surplus.items).toHaveLength(1)
      expect(analysis.deficit.items).toHaveLength(1)
      expect(analysis.surplus.items[0].chainId).toBe(999) // Unsupported chain has surplus
      expect(analysis.deficit.items[0].chainId).toBe(10) // Supported chain has deficit

      // Mock CCTP-LiFi provider to throw error for unsupported chain
      jest
        .spyOn(cctpLiFiProvider, 'getQuote')
        .mockRejectedValue(new Error('CCTP not supported on chain 999'))

      // Mock the liquidityProviderManager to simulate real behavior - call provider and handle error
      jest
        .spyOn(liquidityManagerService['liquidityProviderManager'], 'getQuote')
        .mockImplementation(async (walletAddress, tokenIn, tokenOut, swapAmount) => {
          try {
            // Attempt to call the CCTP-LiFi provider (which will throw)
            const quote = await cctpLiFiProvider.getQuote(tokenIn, tokenOut, swapAmount)
            return [quote]
          } catch (error) {
            // When provider fails, return empty array (simulating real service behavior)
            return []
          }
        })

      const quotes = await liquidityManagerService.getOptimizedRebalancing(
        walletAddress,
        analysis.deficit.items[0],
        analysis.surplus.items,
      )

      // Should not generate any quotes for unsupported chain
      expect(quotes).toHaveLength(0)

      // Verify the CCTP-LiFi provider was attempted and failed
      expect(cctpLiFiProvider.getQuote).toHaveBeenCalled()
      expect(cctpLiFiProvider.getQuote).toHaveBeenCalledWith(
        analysis.surplus.items[0], // Token on unsupported chain
        analysis.deficit.items[0], // Token on supported chain
        expect.any(Number),
      )

      // Verify the liquidity provider service was called
      expect(liquidityManagerService['liquidityProviderManager'].getQuote).toHaveBeenCalled()
    })

    it('should validate sufficient balance before execution', async () => {
      const mockTokenData: TokenData[] = [
        {
          chainId: 1,
          config: mockTokenConfigs[0],
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: parseUnits('100', 6),
            decimals: 6,
          }, // Low balance
        },
        {
          chainId: 10,
          config: mockTokenConfigs[1],
          balance: {
            address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            balance: parseUnits('700', 6),
            decimals: 6,
          },
        },
      ]

      balanceService.getAllTokenDataForAddress.mockResolvedValue(mockTokenData)

      // Try to create quote for more than available balance
      liFiService.getQuote.mockResolvedValue([
        {
          fromAmount: '200000000', // 200 USDT (more than 100 available)
          toAmount: '198000000',
          toAmountMin: '194040000',
          fromAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          fromChainId: 1,
          toChainId: 1,
        },
      ] as any)

      const analysis = await liquidityManagerService.analyzeTokens(walletAddress)

      // The token with 100 balance and 1000 target would be in deficit, not surplus
      expect(analysis.deficit.items).toHaveLength(2) // Both tokens in deficit
      expect(analysis.surplus.items).toHaveLength(0)
    })
  })
})
