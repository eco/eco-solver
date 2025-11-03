import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { parseUnits } from 'viem'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { USDT0LiFiProviderService } from './usdt0-lifi-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { USDT0ProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0/usdt0-provider.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { BalanceService } from '@/balance/balance.service'
import { EcoAnalyticsService } from '@/analytics'
import { TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { extractLiFiTxHash } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/get-transaction-hashes'

describe('USDT0LiFiProviderService', () => {
  let service: USDT0LiFiProviderService
  let liFiService: DeepMocked<LiFiProviderService>
  let usdt0Service: DeepMocked<USDT0ProviderService>

  const mockUSDTMap = {
    chains: [
      {
        chainId: 1,
        eid: 30101,
        type: 'adapter',
        contract: '0xAdapter' as any,
        decimals: 6,
        underlyingToken: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as any,
      },
      {
        chainId: 10,
        eid: 30110,
        type: 'oft',
        contract: '0xOFT' as any,
        decimals: 6,
        token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' as any,
      },
    ],
  }

  const token = (chainId: number, address: string, decimals = 6): TokenData =>
    ({
      chainId,
      config: { chainId, address: address as any, minBalance: 0, targetBalance: 0, type: 'erc20' },
      balance: { address: address as any, decimals, balance: 0n },
    }) as any

  beforeEach(async () => {
    const ecoMock = {
      getUSDT0: jest.fn().mockReturnValue(mockUSDTMap),
      getLiquidityManager: jest.fn().mockReturnValue({ maxQuoteSlippage: 0.05 }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        USDT0LiFiProviderService,
        { provide: LiFiProviderService, useValue: createMock<LiFiProviderService>() },
        { provide: USDT0ProviderService, useValue: createMock<USDT0ProviderService>() },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: ecoMock },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        { provide: RebalanceRepository, useValue: createMock<RebalanceRepository>() },
        {
          provide: getQueueToken(LiquidityManagerQueue.queueName),
          useValue: { add: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile()

    service = module.get(USDT0LiFiProviderService)
    liFiService = module.get(LiFiProviderService) as any
    usdt0Service = module.get(USDT0ProviderService) as any
    // Inject a mock RebalanceRepository directly for failure path assertion
    ;(service as any).rebalanceRepository = createMock<RebalanceRepository>()

    // EcoConfigService already provided with correct mocks before service instantiation

    jest.spyOn(Logger.prototype, 'debug').mockImplementation()
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })

  describe('isRouteAvailable', () => {
    it('should return true for supported cross-chain USDT0 route', async () => {
      const tokenIn = token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      const tokenOut = token(10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(true)
    })

    it('should return false for same-chain routes', async () => {
      const tokenIn = token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      const tokenOut = token(1, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when source chain does not support USDT0', async () => {
      const tokenIn = token(56, '0x1111111111111111111111111111111111111111') // Unsupported chain
      const tokenOut = token(10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when destination chain does not support USDT0', async () => {
      const tokenIn = token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
      const tokenOut = token(56, '0x1111111111111111111111111111111111111111') // Unsupported chain

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })

    it('should return false when both chains do not support USDT0', async () => {
      const tokenIn = token(56, '0x1111111111111111111111111111111111111111')
      const tokenOut = token(97, '0x2222222222222222222222222222222222222222')

      const result = await service.isRouteAvailable(tokenIn, tokenOut)
      expect(result).toBe(false)
    })
  })

  describe('getQuote', () => {
    it('builds TOKEN → TOKEN route with both swaps', async () => {
      const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      const tOut = token(10, '0x4200000000000000000000000000000000000042', 18)

      ;(liFiService.getQuote as any)
        .mockResolvedValueOnce({
          amountOut: parseUnits('99', 6),
          slippage: 0.01,
          context: {
            fromAmount: '100000000',
            toAmount: '99000000',
            toAmountMin: '98010000',
            fromChainId: 1,
            toChainId: 1,
            fromToken: { address: tIn.config.address, decimals: 6 },
            toToken: { address: mockUSDTMap.chains[0].underlyingToken, decimals: 6 },
          },
        })
        .mockResolvedValueOnce({
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
            fromAmount: '99000000',
            toAmount: '45000000000000000000',
            toAmountMin: '44100000000000000000',
            fromChainId: 10,
            toChainId: 10,
            fromToken: { address: mockUSDTMap.chains[1].token, decimals: 6 },
            toToken: { address: tOut.config.address, decimals: 18 },
          },
        })

      const quote = await service.getQuote(tIn, tOut, 100)
      expect(quote.context.steps).toEqual(['sourceSwap', 'usdt0Bridge', 'destinationSwap'])
      expect(quote.context.sourceSwapQuote).toBeDefined()
      expect(quote.context.destinationSwapQuote).toBeDefined()
    })

    it('builds USDT → TOKEN route (no source swap)', async () => {
      const tIn = token(1, mockUSDTMap.chains[0].underlyingToken!)
      const tOut = token(10, '0x4200000000000000000000000000000000000042', 18)

      ;(liFiService.getQuote as any).mockResolvedValueOnce({
        amountOut: parseUnits('45', 18),
        slippage: 0.02,
        context: {
          fromAmount: '100000000',
          toAmount: '45000000000000000000',
          toAmountMin: '44100000000000000000',
          fromChainId: 10,
          toChainId: 10,
        },
      })

      const quote = await service.getQuote(tIn, tOut, 100)
      expect(quote.context.steps).toEqual(['usdt0Bridge', 'destinationSwap'])
      expect(quote.context.sourceSwapQuote).toBeUndefined()
      expect(quote.context.destinationSwapQuote).toBeDefined()
    })

    it('builds TOKEN → USDT route (no destination swap)', async () => {
      const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      const tOut = token(10, mockUSDTMap.chains[1].token!)

      ;(liFiService.getQuote as any).mockResolvedValueOnce({
        amountOut: parseUnits('99', 6),
        slippage: 0.01,
        context: {
          fromAmount: '100000000',
          toAmount: '99000000',
          toAmountMin: '98010000',
          fromChainId: 1,
          toChainId: 1,
        },
      })

      const quote = await service.getQuote(tIn, tOut, 100)
      expect(quote.context.steps).toEqual(['sourceSwap', 'usdt0Bridge'])
      expect(quote.context.destinationSwapQuote).toBeUndefined()
    })

    it('builds USDT → USDT route (bridge only)', async () => {
      const tIn = token(1, mockUSDTMap.chains[0].underlyingToken!)
      const tOut = token(10, mockUSDTMap.chains[1].token!)

      const quote = await service.getQuote(tIn, tOut, 100)
      expect(quote.context.steps).toEqual(['usdt0Bridge'])
      expect(quote.context.sourceSwapQuote).toBeUndefined()
      expect(quote.context.destinationSwapQuote).toBeUndefined()
    })
  })

  describe('execute', () => {
    it('executes source swap then bridges and enqueues delivery check with context', async () => {
      const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
      const tOut = token(10, '0x4200000000000000000000000000000000000042', 18)

      ;(liFiService.execute as any).mockResolvedValue({
        steps: [{ execution: { process: [{ txHash: '0xsourcetx' }] } }],
      })
      ;(liFiService.getQuote as any)
        .mockResolvedValueOnce({
          amountOut: parseUnits('99', 6),
          slippage: 0.01,
          context: {
            fromAmount: '100000000',
            toAmount: '99000000',
            toAmountMin: '98010000',
            fromChainId: 1,
            toChainId: 1,
            fromToken: { address: tIn.config.address, decimals: 6 },
            toToken: { address: mockUSDTMap.chains[0].underlyingToken, decimals: 6 },
          },
        })
        .mockResolvedValueOnce({
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
            fromAmount: '99000000',
            toAmount: '45000000000000000000',
            toAmountMin: '44100000000000000000',
            fromChainId: 10,
            toChainId: 10,
            fromToken: { address: mockUSDTMap.chains[1].token, decimals: 6 },
            toToken: { address: tOut.config.address, decimals: 18 },
          },
        })
      ;(usdt0Service.execute as any).mockResolvedValue('0xbridge')

      const quote = await service.getQuote(tIn, tOut, 100)
      const tx = await service.execute('0xwallet', quote)
      expect(tx).toBe('0xbridge')

      // ensure USDT0LiFi context is propagated into USDT0ProviderService.execute
      expect(usdt0Service.execute).toHaveBeenCalledTimes(1)
      const [, forwardedQuote] = (usdt0Service.execute as any).mock.calls[0]
      expect(forwardedQuote?.context?.usdt0LiFiContext).toBeDefined()
      expect(forwardedQuote.context.usdt0LiFiContext.destinationSwapQuote).toBeDefined()
      expect(forwardedQuote.context.usdt0LiFiContext.walletAddress).toBe('0xwallet')

      // and USDT0LiFi provider itself does not enqueue a delivery check job
      const spy = jest.spyOn(LiquidityManagerQueue.prototype as any, 'startOFTDeliveryCheck')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('marks FAILED on USDT0 bridge error and rethrows', async () => {
    const tIn = token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    const tOut = token(10, '0x4200000000000000000000000000000000000042', 18)

    ;(liFiService.execute as any).mockResolvedValue({
      steps: [{ execution: { process: [{ txHash: '0xsourcetx' }] } }],
    })
    ;(liFiService.getQuote as any)
      .mockResolvedValueOnce({
        amountOut: parseUnits('99', 6),
        slippage: 0.01,
        context: {
          fromAmount: '100000000',
          toAmount: '99000000',
          toAmountMin: '98010000',
          fromChainId: 1,
          toChainId: 1,
          fromToken: { address: tIn.config.address, decimals: 6 },
          toToken: { address: mockUSDTMap.chains[0].underlyingToken, decimals: 6 },
        },
      })
      .mockResolvedValueOnce({
        amountOut: parseUnits('45', 18),
        slippage: 0.02,
        context: {
          fromAmount: '99000000',
          toAmount: '45000000000000000000',
          toAmountMin: '44100000000000000000',
          fromChainId: 10,
          toChainId: 10,
          fromToken: { address: mockUSDTMap.chains[1].token, decimals: 6 },
          toToken: { address: tOut.config.address, decimals: 18 },
        },
      })
    ;(usdt0Service.execute as any).mockRejectedValue(new Error('bridge failed'))

    const injectedRepo = (service as any).rebalanceRepository as jest.Mocked<RebalanceRepository>
    injectedRepo.updateStatus = jest.fn() as any

    const quote = await service.getQuote(tIn, tOut, 100)
    const withIds = { ...quote, groupID: 'grp-1', rebalanceJobID: 'reb-1' } as any
    await expect(service.execute('0xwallet', withIds)).rejects.toThrow('bridge failed')
    expect(injectedRepo.updateStatus).toHaveBeenCalledWith('reb-1', RebalanceStatus.FAILED)
  })

  describe('extractLiFiTxHash helper', () => {
    it('returns the latest txHash scanning steps and processes in reverse (tx in last process of last step)', () => {
      const lifiResult = {
        steps: [
          {
            execution: {
              process: [
                { type: 'ALLOWANCE', status: 'DONE' },
                { type: 'SWAP', status: 'DONE' },
              ],
            },
          },
          {
            execution: {
              process: [
                { type: 'ALLOWANCE', status: 'DONE' },
                { type: 'SWAP', status: 'DONE', txHash: '0xlast' },
              ],
            },
          },
        ],
      }
      const tx = extractLiFiTxHash(lifiResult)
      expect(tx).toBe('0xlast')
    })

    it('returns txHash when present in an earlier process of a later step', () => {
      const lifiResult = {
        steps: [
          { execution: { process: [{ type: 'APPROVE', status: 'DONE' }] } },
          { execution: { process: [{ type: 'SWAP', status: 'DONE', txHash: '0xhash2' }] } },
        ],
      }
      const tx = extractLiFiTxHash(lifiResult)
      expect(tx).toBe('0xhash2')
    })

    it('returns txHash when only the first step contains it', () => {
      const lifiResult = {
        steps: [
          { execution: { process: [{ type: 'SWAP', status: 'DONE', txHash: '0xfirst' }] } },
          { execution: { process: [{ type: 'SWAP', status: 'DONE' }] } },
        ],
      }
      const tx = extractLiFiTxHash(lifiResult)
      expect(tx).toBe('0xfirst')
    })

    it('returns 0x0 when no txHash is present', () => {
      const lifiResult = { steps: [{ execution: { process: [] } }] }
      const tx = extractLiFiTxHash(lifiResult)
      expect(tx).toBeUndefined()
    })
  })
})
