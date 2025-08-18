import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { parseUnits } from 'viem'
import { CCTPLiFiProviderService } from './cctp-lifi-provider.service'
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { BalanceService } from '@eco-solver/balance/balance.service'
import { LiquidityManagerQueue } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue'
import { TokenData, RebalanceQuote } from '@eco-solver/liquidity-manager/types/types'
import { CCTPLiFiRoutePlanner } from './utils/route-planner'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { createMock } from '@golevelup/ts-jest'

describe('CCTPLiFiProviderService', () => {
  let service: CCTPLiFiProviderService
  let liFiService: jest.Mocked<LiFiProviderService>
  let cctpService: jest.Mocked<CCTPProviderService>
  let mockQueue: any

  const mockTokenIn: TokenData = {
    chainId: 1, // Ethereum
    config: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT address
      chainId: 1,
      minBalance: 0,
      targetBalance: 0,
      type: 'erc20',
    },
    balance: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      balance: parseUnits('1000', 6),
    },
  }

  const mockTokenOut: TokenData = {
    chainId: 10, // Optimism
    config: {
      address: '0x4200000000000000000000000000000000000042', // OP token
      chainId: 10,
      minBalance: 0,
      targetBalance: 0,
      type: 'erc20',
    },
    balance: {
      address: '0x4200000000000000000000000000000000000042',
      decimals: 18,
      balance: 0n,
    },
  }

  const mockUSDCEthereum: TokenData = {
    chainId: 1,
    config: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC Ethereum (checksummed)
      chainId: 1,
      minBalance: 0,
      targetBalance: 0,
      type: 'erc20',
    },
    balance: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      balance: parseUnits('1000', 6),
    },
  }

  const mockUSDCOptimism: TokenData = {
    chainId: 10,
    config: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC Optimism (checksummed)
      chainId: 10,
      minBalance: 0,
      targetBalance: 0,
      type: 'erc20',
    },
    balance: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
      balance: 0n,
    },
  }

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    }

    const mockLiFiService = {
      getQuote: jest.fn(),
      execute: jest.fn(),
      getStrategy: jest.fn().mockReturnValue('LiFi'),
    }

    const mockCCTPService = {
      getQuote: jest.fn(),
      execute: jest.fn(),
      executeWithMetadata: jest.fn(),
      receiveMessage: jest.fn(),
    }

    const mockEcoConfigService = {
      getCCTP: jest.fn().mockReturnValue({
        chains: [
          { chainId: 1, token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          { chainId: 10, token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
        ],
      }),
      getCCTPLiFiConfig: jest.fn().mockReturnValue({
        maxSlippage: 0.05,
        usdcAddresses: {
          1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        },
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CCTPLiFiProviderService,
        { provide: LiFiProviderService, useValue: mockLiFiService },
        { provide: CCTPProviderService, useValue: mockCCTPService },
        { provide: BalanceService, useValue: { fetchTokenBalance: jest.fn() } },
        { provide: EcoConfigService, useValue: mockEcoConfigService },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
        {
          provide: getQueueToken(LiquidityManagerQueue.queueName),
          useValue: mockQueue,
        },
      ],
    }).compile()

    service = module.get<CCTPLiFiProviderService>(CCTPLiFiProviderService)
    liFiService = module.get(LiFiProviderService)
    cctpService = module.get(CCTPProviderService)

    // Mock logger to avoid log spam
    jest.spyOn(Logger.prototype, 'debug').mockImplementation()
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Reset CCTPLiFiRoutePlanner to defaults to ensure test isolation
    CCTPLiFiRoutePlanner.resetToDefaults()
  })

  describe('Basic Functionality', () => {
    it('should be defined', () => {
      expect(service).toBeDefined()
    })

    it('should return CCTPLiFi strategy', () => {
      expect(service.getStrategy()).toBe('CCTPLiFi')
    })
  })

  describe('Route Planning', () => {
    it('should plan correct route for TOKEN → TOKEN cross-chain', () => {
      const steps = CCTPLiFiRoutePlanner.planRoute(mockTokenIn, mockTokenOut)
      expect(steps).toHaveLength(3)
      expect(steps[0].type).toBe('sourceSwap')
      expect(steps[1].type).toBe('cctpBridge')
      expect(steps[2].type).toBe('destinationSwap')
    })

    it('should plan route for USDC → TOKEN (no source swap)', () => {
      const steps = CCTPLiFiRoutePlanner.planRoute(mockUSDCEthereum, mockTokenOut)
      expect(steps).toHaveLength(2)
      expect(steps[0].type).toBe('cctpBridge')
      expect(steps[1].type).toBe('destinationSwap')
    })

    it('should plan route for TOKEN → USDC (no destination swap)', () => {
      const steps = CCTPLiFiRoutePlanner.planRoute(mockTokenIn, mockUSDCOptimism)
      expect(steps).toHaveLength(2)
      expect(steps[0].type).toBe('sourceSwap')
      expect(steps[1].type).toBe('cctpBridge')
    })

    it('should plan route for USDC → USDC (CCTP only)', () => {
      const steps = CCTPLiFiRoutePlanner.planRoute(mockUSDCEthereum, mockUSDCOptimism)
      expect(steps).toHaveLength(1)
      expect(steps[0].type).toBe('cctpBridge')
    })

    it('should validate CCTP support for both chains', () => {
      const isSupported = CCTPLiFiRoutePlanner.validateCCTPSupport(1, 10)
      expect(isSupported).toBe(true)
    })

    it('should reject unsupported chains', () => {
      const isSupported = CCTPLiFiRoutePlanner.validateCCTPSupport(1, 999)
      expect(isSupported).toBe(false)
    })
  })

  describe('getQuote - Phase 3 Comprehensive Testing', () => {
    it('should get quote for TOKEN → TOKEN route with all steps', async () => {
      // Mock LiFi quotes
      liFiService.getQuote
        .mockResolvedValueOnce({
          // Source swap: USDT → USDC
          amountOut: parseUnits('99', 6),
          slippage: 0.01,
          context: {
            fromAmount: '100000000', // 100 USDT (6 decimals)
            toAmount: '99000000', // 99 USDC (6 decimals)
            toAmountMin: '98010000', // 98.01 USDC minimum
            fromAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            fromChainId: 1,
            toChainId: 1,
          },
        } as any)
        .mockResolvedValueOnce({
          // Destination swap: USDC → OP
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
            fromAmount: '99000000', // 99 USDC
            toAmount: '45000000000000000000', // 45 OP
            toAmountMin: '44100000000000000000', // 44.1 OP minimum
            fromAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            toAddress: '0x4200000000000000000000000000000000000042',
            fromChainId: 10,
            toChainId: 10,
          },
        } as any)

      const quote = await service.getQuote(mockTokenIn, mockTokenOut, 100, 'test-id')

      expect(quote).toEqual({
        amountIn: parseUnits('100', 6),
        amountOut: parseUnits('45', 18),
        id: 'test-id',
        slippage: expect.any(Number),
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        strategy: 'CCTPLiFi',
        context: expect.objectContaining({
          steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
          sourceSwapQuote: expect.any(Object),
          destinationSwapQuote: expect.any(Object),
          cctpTransfer: expect.objectContaining({
            sourceChain: 1,
            destinationChain: 10,
          }),
          gasEstimation: expect.objectContaining({
            sourceChainGas: expect.any(BigInt),
            destinationChainGas: expect.any(BigInt),
            totalGasUSD: expect.any(Number),
            gasWarnings: expect.any(Array),
          }),
        }),
      })

      expect(liFiService.getQuote).toHaveBeenCalledTimes(2)
    })

    it('should get quote for USDC → TOKEN route (no source swap)', async () => {
      liFiService.getQuote.mockResolvedValueOnce({
        amountOut: parseUnits('45', 18),
        slippage: 0.02,
        context: {
          fromAmount: '100000000',
          toAmount: '45000000000000000000',
          toAmountMin: '44100000000000000000',
          fromAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          toAddress: '0x4200000000000000000000000000000000000042',
          fromChainId: 10,
          toChainId: 10,
        },
      } as any)

      const quote = await service.getQuote(mockUSDCEthereum, mockTokenOut, 100)

      expect(quote.context.steps).toEqual(['cctpBridge', 'destinationSwap'])
      expect(quote.context.sourceSwapQuote).toBeUndefined()
      expect(quote.context.destinationSwapQuote).toBeDefined()
      expect(liFiService.getQuote).toHaveBeenCalledTimes(1)
    })

    it('should get quote for TOKEN → USDC route (no destination swap)', async () => {
      liFiService.getQuote.mockResolvedValueOnce({
        amountOut: parseUnits('99', 6),
        slippage: 0.01,
        context: {
          fromAmount: '100000000',
          toAmount: '99000000',
          toAmountMin: '98010000',
          fromAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          fromChainId: 1,
          toChainId: 1,
        },
      } as any)

      const quote = await service.getQuote(mockTokenIn, mockUSDCOptimism, 100)

      expect(quote.context.steps).toEqual(['sourceSwap', 'cctpBridge'])
      expect(quote.context.sourceSwapQuote).toBeDefined()
      expect(quote.context.destinationSwapQuote).toBeUndefined()
      expect(liFiService.getQuote).toHaveBeenCalledTimes(1)
    })

    it('should get quote for USDC → USDC route (CCTP only)', async () => {
      const quote = await service.getQuote(mockUSDCEthereum, mockUSDCOptimism, 100)

      expect(quote.context.steps).toEqual(['cctpBridge'])
      expect(quote.context.sourceSwapQuote).toBeUndefined()
      expect(quote.context.destinationSwapQuote).toBeUndefined()
      expect(liFiService.getQuote).not.toHaveBeenCalled()
    })

    it('should throw error for same-chain routes', async () => {
      const sameChainTokenOut = { ...mockTokenOut, chainId: 1 }

      await expect(service.getQuote(mockTokenIn, sameChainTokenOut, 100)).rejects.toThrow(
        'Invalid CCTPLiFi route',
      )
    })

    it('should throw error for unsupported chains', async () => {
      const unsupportedTokenOut = { ...mockTokenOut, chainId: 56 } // BSC not supported

      await expect(service.getQuote(mockTokenIn, unsupportedTokenOut, 100)).rejects.toThrow(
        'Invalid CCTPLiFi route',
      )
    })

    it('should warn about high slippage', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')

      liFiService.getQuote
        .mockResolvedValueOnce({
          amountOut: parseUnits('85', 6), // High slippage
          slippage: 0.15, // 15% slippage
          context: {
            fromAmount: '100000000',
            toAmount: '85000000',
            toAmountMin: '72250000',
            fromAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            fromChainId: 1,
            toChainId: 1,
          },
        } as any)
        .mockResolvedValueOnce({
          amountOut: parseUnits('35', 18),
          slippage: 0.15,
          context: {
            fromAmount: '85000000',
            toAmount: '85000000',
            toAmountMin: '80000000',
            fromAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            toAddress: '0x4200000000000000000000000000000000000042',
            fromChainId: 10,
            toChainId: 10,
          },
        } as any)

      await service.getQuote(mockTokenIn, mockTokenOut, 100)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining('High total slippage detected'),
          route: expect.arrayContaining([
            expect.objectContaining({ type: 'sourceSwap' }),
            expect.objectContaining({ type: 'cctpBridge' }),
            expect.objectContaining({ type: 'destinationSwap' }),
          ]),
        }),
      )
    })
  })

  describe('execute - Phase 3 Execution & Queuing', () => {
    let mockQuote: RebalanceQuote<'CCTPLiFi'>

    beforeEach(() => {
      mockQuote = {
        amountIn: parseUnits('100', 6),
        amountOut: parseUnits('45', 18),
        slippage: 0.03,
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        strategy: 'CCTPLiFi',
        context: {
          sourceSwapQuote: {
            fromAmount: '100000000',
            toAmount: '99000000',
            toAmountMin: '98010000',
            fromAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            toAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            fromChainId: 1,
            toChainId: 1,
            fromToken: {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              decimals: 6,
            },
            toToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
          },
          cctpTransfer: {
            sourceChain: 1,
            destinationChain: 10,
            amount: parseUnits('99', 6),
          },
          destinationSwapQuote: {
            fromAmount: '99000000',
            toAmount: '45000000000000000000',
            toAmountMin: '44100000000000000000',
            fromAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            toAddress: '0x4200000000000000000000000000000000000042',
            fromChainId: 10,
            toChainId: 10,
            fromToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
            toToken: {
              address: '0x4200000000000000000000000000000000000042',
              decimals: 18,
            },
          },
          steps: ['sourceSwap', 'cctpBridge', 'destinationSwap'],
        },
      } as any
    })

    it('should execute full CCTPLiFi route with source swap, CCTP bridge, and queue destination swap', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'

      // Mock LiFi source swap with proper return type
      liFiService.execute.mockResolvedValueOnce({
        steps: [
          {
            execution: {
              process: [
                {
                  txHash: '0xsourcetxhash',
                  type: 'TRANSACTION',
                  status: 'DONE',
                },
              ],
            },
          },
        ],
      } as any)

      // Mock CCTP bridge execution using the new enhanced method
      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      const result = await service.execute(walletAddress, mockQuote)

      expect(typeof result).toBe('string') // Should return a transaction hash
      expect(liFiService.execute).toHaveBeenCalledTimes(1)
      expect(cctpService.executeWithMetadata).toHaveBeenCalledTimes(1)
      expect(mockQueue.add).toHaveBeenCalledWith(
        'CHECK_CCTP_ATTESTATION',
        expect.objectContaining({
          destinationChainId: 10,
          messageHash: '0xmessagehash',
          messageBody: '0xmessagebody',
        }),
        expect.any(Object),
      )
    })

    it('should handle USDC-only route (no source swap)', async () => {
      const usdcQuote = {
        ...mockQuote,
        context: {
          ...mockQuote.context,
          sourceSwapQuote: undefined,
          steps: ['cctpBridge', 'destinationSwap'] as (
            | 'sourceSwap'
            | 'cctpBridge'
            | 'destinationSwap'
          )[],
        },
      }

      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      await service.execute('0xwallet', usdcQuote)

      expect(liFiService.execute).not.toHaveBeenCalled()
      expect(cctpService.executeWithMetadata).toHaveBeenCalledTimes(1)
      expect(mockQueue.add).toHaveBeenCalledTimes(1) // CCTP attestation always needed
    })

    it('should handle USDC-to-USDC route (CCTP only)', async () => {
      const usdcOnlyQuote = {
        ...mockQuote,
        context: {
          ...mockQuote.context,
          sourceSwapQuote: undefined,
          destinationSwapQuote: undefined,
          steps: ['cctpBridge'] as ('sourceSwap' | 'cctpBridge' | 'destinationSwap')[],
        },
      }

      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      await service.execute('0xwallet', usdcOnlyQuote)

      expect(liFiService.execute).not.toHaveBeenCalled()
      expect(cctpService.executeWithMetadata).toHaveBeenCalledTimes(1)
      expect(mockQueue.add).toHaveBeenCalledTimes(1) // CCTP attestation always needed
    })

    it('should handle execution failures gracefully', async () => {
      liFiService.execute.mockRejectedValueOnce(new Error('LiFi execution failed'))

      await expect(service.execute('0xwallet', mockQuote)).rejects.toThrow('LiFi execution failed')
    })

    it('should handle CCTP bridge failures', async () => {
      // Mock successful LiFi execution first
      liFiService.execute.mockResolvedValueOnce({
        steps: [
          {
            execution: {
              process: [{ txHash: '0xsourcetxhash' }],
            },
          },
        ],
      } as any)

      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockRejectedValueOnce(new Error('CCTP bridge failed'))

      await expect(service.execute('0xwallet', mockQuote)).rejects.toThrow('CCTP bridge failed')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle LiFi quote failures during route building', async () => {
      liFiService.getQuote.mockRejectedValueOnce(new Error('LiFi service unavailable'))

      await expect(service.getQuote(mockTokenIn, mockTokenOut, 100)).rejects.toThrow(
        'Failed to build route context',
      )
    })
  })
})
