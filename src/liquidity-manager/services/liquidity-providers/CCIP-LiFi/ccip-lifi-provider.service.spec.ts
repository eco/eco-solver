import { Test, TestingModule } from '@nestjs/testing'
import { CCIPLiFiProviderService } from './ccip-lifi-provider.service'
import { LiFiProviderService } from '../LiFi/lifi-provider.service'
import { CCIPProviderService } from '../CCIP/ccip-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoAnalyticsService } from '@/analytics/eco-analytics.service'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { getQueueToken } from '@nestjs/bullmq'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { TokenData } from '@/liquidity-manager/types/types'
import { Hex } from 'viem'
import { CCIPLiFiRoutePlanner } from './utils/route-planner'

describe('CCIPLiFiProviderService', () => {
  let service: CCIPLiFiProviderService
  let liFiService: jest.Mocked<LiFiProviderService>
  let ccipService: jest.Mocked<CCIPProviderService>

  const bridgeTokenSource = '0x0000000000000000000000000000000000000001' as Hex
  const bridgeTokenDestination = '0x000000000000000000000000000000000000000A' as Hex

  const makeTokenData = (chainId: number, address: string, decimals = 18): TokenData =>
    ({
      chainId,
      config: { address: address as Hex, chainId, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address: address as Hex, decimals, balance: 0n },
    }) as TokenData

  const buildLiFiQuote = (context: any): any => ({
    amountIn: 0n,
    amountOut: 0n,
    slippage: 0,
    tokenIn: makeTokenData(
      context.fromChainId,
      context.fromToken.address as string,
      context.fromToken.decimals,
    ),
    tokenOut: makeTokenData(
      context.toChainId,
      context.toToken.address as string,
      context.toToken.decimals,
    ),
    strategy: 'LiFi',
    context,
  })

  const sourceRoute = {
    id: 'source-route',
    fromChainId: 1,
    toChainId: 1,
    fromToken: { address: '0x1111111111111111111111111111111111111111', decimals: 18 },
    toToken: { address: bridgeTokenSource, decimals: 6 },
    fromAmount: '1000000000000000000',
    toAmount: '1000000',
    toAmountMin: '990000',
  } as any

  const destinationRoute = {
    id: 'dest-route',
    fromChainId: 10,
    toChainId: 10,
    fromToken: { address: bridgeTokenDestination, decimals: 6 },
    toToken: { address: '0x2222222222222222222222222222222222222222', decimals: 18 },
    fromAmount: '1000000',
    toAmount: '990000000000000000',
    toAmountMin: '980000000000000000',
  } as any

  beforeEach(async () => {
    CCIPLiFiRoutePlanner.updateBridgeTokens({
      1: { USDC: bridgeTokenSource },
      10: { USDC: bridgeTokenDestination },
    })

    const mockQueue = { add: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CCIPLiFiProviderService,
        {
          provide: LiFiProviderService,
          useValue: { getQuote: jest.fn(), execute: jest.fn(), getStrategy: () => 'LiFi' },
        },
        {
          provide: CCIPProviderService,
          useValue: {
            getQuote: jest.fn(),
            execute: jest.fn(),
            getStrategy: () => 'CCIP',
            isRouteAvailable: jest.fn().mockResolvedValue(true), // Default: all routes allowed
          },
        },
        {
          provide: EcoConfigService,
          useValue: {
            getCCIPLiFiConfig: () => ({
              maxSlippage: 0.05,
              bridgeTokens: {
                1: { USDC: bridgeTokenSource },
                10: { USDC: bridgeTokenDestination },
              },
            }),
            getCCIP: () => ({
              chains: [
                {
                  chainId: 1,
                  tokens: {
                    USDC: {
                      symbol: 'USDC',
                      address: bridgeTokenSource,
                      decimals: 6,
                    },
                  },
                },
                {
                  chainId: 10,
                  tokens: {
                    USDC: {
                      symbol: 'USDC',
                      address: bridgeTokenDestination,
                      decimals: 6,
                    },
                  },
                },
              ],
            }),
          },
        },
        { provide: EcoAnalyticsService, useValue: { trackError: jest.fn() } },
        { provide: RebalanceRepository, useValue: { updateStatus: jest.fn() } },
        { provide: getQueueToken(LiquidityManagerQueue.queueName), useValue: mockQueue },
      ],
    }).compile()

    service = module.get<CCIPLiFiProviderService>(CCIPLiFiProviderService)
    liFiService = module.get(LiFiProviderService)
    ccipService = module.get(CCIPProviderService)
  })

  describe('isRouteAvailable', () => {
    it('should return true when CCIPProviderService allows the route', async () => {
      ccipService.isRouteAvailable.mockResolvedValue(true)

      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(true)
      expect(ccipService.isRouteAvailable).toHaveBeenCalled()
    })

    it('should return false for same-chain routes', async () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(1, '0x2222222222222222222222222222222222222222')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when source chain has no bridge tokens configured', async () => {
      const tokenIn = makeTokenData(56, '0x1111111111111111111111111111111111111111') // BSC not in bridge tokens
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when destination chain has no bridge tokens configured', async () => {
      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(56, '0x2222222222222222222222222222222222222222') // BSC not in bridge tokens

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when CCIPProviderService denies the route', async () => {
      // CCIPProviderService denies the route (e.g., deniedDestinations contains the chain)
      ccipService.isRouteAvailable.mockResolvedValue(false)

      const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
      const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })
  })

  it('builds route context with source and destination swaps', async () => {
    ccipService.isRouteAvailable.mockResolvedValue(true)

    const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
    const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

    liFiService.getQuote.mockResolvedValueOnce(buildLiFiQuote(sourceRoute))
    liFiService.getQuote.mockResolvedValueOnce(buildLiFiQuote(destinationRoute))

    const quote = await service.getQuote(tokenIn, tokenOut, 1, 'test-id')

    expect(quote.context.steps).toEqual(['sourceSwap', 'ccipBridge', 'destinationSwap'])
    expect(quote.context.sourceSwapQuote).toBeDefined()
    expect(quote.context.destinationSwapQuote).toBeDefined()
    expect(liFiService.getQuote).toHaveBeenCalledTimes(2)
  })

  it('executes flow with source swap and CCIP bridge', async () => {
    ccipService.isRouteAvailable.mockResolvedValue(true)

    const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
    const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

    liFiService.getQuote.mockResolvedValueOnce(buildLiFiQuote(sourceRoute))
    liFiService.getQuote.mockResolvedValueOnce(buildLiFiQuote(destinationRoute))
    liFiService.execute.mockResolvedValueOnce({
      steps: [
        {
          execution: {
            process: [
              { txHash: '0xsourceswap', type: 'SWAP', status: 'DONE', startedAt: Date.now() },
            ],
            status: 'DONE',
            startedAt: Date.now(),
          },
        } as any,
      ],
    } as any)

    const mockCCIPQuote = {
      amountIn: 1000000n,
      amountOut: 1000000n,
      slippage: 0,
      tokenIn: makeTokenData(1, bridgeTokenSource, 6),
      tokenOut: makeTokenData(10, bridgeTokenDestination, 6),
      strategy: 'CCIP',
      context: {
        router: '0xrouter',
        sourceChainSelector: '1',
        destinationChainSelector: '10',
        destinationAccount: '0xwallet' as Hex,
        tokenSymbol: 'USDC',
        tokenAddress: bridgeTokenSource,
        amount: 1000000n,
        estimatedFee: 100000n,
      },
    }

    ccipService.getQuote.mockResolvedValueOnce(mockCCIPQuote as any)
    ccipService.execute.mockResolvedValueOnce('0xbridge')

    const quote = await service.getQuote(tokenIn, tokenOut, 1, 'test-id')
    const result = await service.execute('0xwallet', quote)

    expect(result).toBe('0xbridge')
    expect(liFiService.execute).toHaveBeenCalledTimes(1)
    expect(ccipService.execute).toHaveBeenCalledTimes(1)
  })

  it('throws when no valid bridge token route exists', async () => {
    // CCIPProviderService denies all routes
    ccipService.isRouteAvailable.mockResolvedValue(false)

    const tokenIn = makeTokenData(1, '0x1111111111111111111111111111111111111111')
    const tokenOut = makeTokenData(10, '0x2222222222222222222222222222222222222222')

    await expect(service.getQuote(tokenIn, tokenOut, 1, 'test-id')).rejects.toThrow()
  })
})
