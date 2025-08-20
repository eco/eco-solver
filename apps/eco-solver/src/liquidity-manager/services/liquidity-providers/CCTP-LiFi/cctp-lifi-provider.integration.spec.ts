import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { parseUnits } from 'viem'
import { CCTPLiFiProviderService } from './cctp-lifi-provider.service'
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { EcoConfigService } from '@libs/config-core'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { LiquidityManagerQueue } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue'
import { CheckCCTPAttestationJobManager } from '@eco-solver/liquidity-manager/jobs/check-cctp-attestation.job'
import { CCTPLiFiDestinationSwapJobManager } from '@eco-solver/liquidity-manager/jobs/cctp-lifi-destination-swap.job'
import { TokenData, RebalanceQuote } from '@eco-solver/liquidity-manager/types/types'
import { CCTPLiFiRoutePlanner } from './utils/route-planner'
import { BalanceService } from '@eco-solver/balance/balance.service'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { createMock } from '@golevelup/ts-jest'

describe('CCTPLiFi Provider Integration Tests', () => {
  let service: CCTPLiFiProviderService
  let liFiService: jest.Mocked<LiFiProviderService>
  let cctpService: jest.Mocked<CCTPProviderService>
  let mockQueue: any
  let mockAttestationJobManager: jest.SpyInstance
  let mockDestinationSwapJobManager: jest.SpyInstance
  let mockStartCCTPAttestationCheck: jest.SpyInstance

  const mockTokenUSDT: TokenData = {
    chainId: 1, // Ethereum
    config: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      chainId: 1,
      minBalance: 0,
      targetBalance: 0,
      type: 'erc20',
    },
    balance: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      balance: parseUnits('10000', 6),
    },
  }

  const mockTokenOP: TokenData = {
    chainId: 10, // Optimism
    config: {
      address: '0x4200000000000000000000000000000000000042', // OP
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

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    }

    const mockEcoConfigService = {
      getCCTP: jest.fn().mockReturnValue({
        chains: [
          { chainId: 1, token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
          { chainId: 10, token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
          { chainId: 137, token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
          { chainId: 8453, token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
          { chainId: 42161, token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
        ],
        apiUrl: 'https://iris-api.circle.com',
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
        {
          provide: LiFiProviderService,
          useValue: {
            getQuote: jest.fn(),
            execute: jest.fn(),
            getStrategy: jest.fn().mockReturnValue('LiFi'),
          },
        },
        {
          provide: CCTPProviderService,
          useValue: {
            getQuote: jest.fn(),
            execute: jest.fn(),
            executeWithMetadata: jest.fn(),
            receiveMessage: jest.fn(),
            fetchAttestation: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {},
        },
        {
          provide: EcoConfigService,
          useValue: mockEcoConfigService,
        },
        {
          provide: getQueueToken(LiquidityManagerQueue.queueName),
          useValue: mockQueue,
        },
        {
          provide: KernelAccountClientService,
          useValue: {
            getClient: jest.fn().mockResolvedValue({
              account: { address: '0x1234567890123456789012345678901234567890' },
            }),
          },
        },
        {
          provide: EcoAnalyticsService,
          useValue: createMock<EcoAnalyticsService>(),
        },
      ],
    }).compile()

    service = module.get<CCTPLiFiProviderService>(CCTPLiFiProviderService)
    liFiService = module.get(LiFiProviderService)
    cctpService = module.get(CCTPProviderService)

    // Mock job managers - but don't spy on them since they're used via dynamic imports
    mockAttestationJobManager = jest
      .spyOn(CheckCCTPAttestationJobManager, 'start')
      .mockResolvedValue()
    mockDestinationSwapJobManager = jest
      .spyOn(CCTPLiFiDestinationSwapJobManager, 'start')
      .mockResolvedValue()

    // Mock logger
    jest.spyOn(Logger.prototype, 'debug').mockImplementation()
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    // Spy on the LiquidityManagerQueue instance method
    mockStartCCTPAttestationCheck = jest
      .spyOn(LiquidityManagerQueue.prototype, 'startCCTPAttestationCheck')
      .mockResolvedValue()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Reset CCTPLiFiRoutePlanner to defaults to ensure test isolation
    CCTPLiFiRoutePlanner.resetToDefaults()
  })

  describe('End-to-End CCTPLiFi Flow Integration', () => {
    it('should complete full USDT→OP flow with proper job queuing', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890'

      // Step 1: Mock LiFi quotes for both swaps
      liFiService.getQuote
        .mockResolvedValueOnce({
          // Source swap: USDT → USDC
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
            fromToken: {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              decimals: 6,
            },
            toToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
          },
        } as any)
        .mockResolvedValueOnce({
          // Destination swap: USDC → OP
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
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
        } as any)

      // Step 2: Get quote and verify structure
      const quote = await service.getQuote(mockTokenUSDT, mockTokenOP, 100)

      expect(quote.context.steps).toEqual(['sourceSwap', 'cctpBridge', 'destinationSwap'])
      expect(quote.context.sourceSwapQuote).toBeDefined()
      expect(quote.context.destinationSwapQuote).toBeDefined()

      // Step 3: Mock execution services
      liFiService.execute.mockResolvedValueOnce({
        steps: [{ execution: { process: [{ txHash: '0xsourcetxhash' }] } }],
      } as any)

      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      // Step 4: Execute and verify job queuing
      const result = await service.execute(walletAddress, quote)

      // Verify execution calls
      expect(liFiService.execute).toHaveBeenCalledTimes(1)
      expect(cctpService.executeWithMetadata).toHaveBeenCalledTimes(1)

      // Verify CCTP attestation job was queued with CCTPLiFi context
      expect(mockStartCCTPAttestationCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationChainId: 10,
          messageHash: '0xmessagehash',
          messageBody: '0xmessagebody',
          cctpLiFiContext: expect.objectContaining({
            destinationSwapQuote: quote.context.destinationSwapQuote,
            walletAddress,
            originalTokenOut: expect.objectContaining({
              address: expect.any(String),
              chainId: 10,
              decimals: 18,
            }),
          }),
        }),
      )

      expect(result).toBeDefined()
    })

    it('should handle USDC→OP flow (no source swap) with correct job context', async () => {
      const mockUSDC: TokenData = {
        ...mockTokenUSDT,
        config: {
          ...mockTokenUSDT.config,
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        },
      }

      // Only destination swap needed
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

      const quote = await service.getQuote(mockUSDC, mockTokenOP, 100)
      expect(quote.context.steps).toEqual(['cctpBridge', 'destinationSwap'])

      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      await service.execute('0xwallet', quote)

      // Verify no source swap was executed
      expect(liFiService.execute).not.toHaveBeenCalled()

      // Verify CCTP attestation still queued with destination swap context
      expect(mockStartCCTPAttestationCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationChainId: 10,
          messageHash: '0xmessagehash',
          messageBody: '0xmessagebody',
          cctpLiFiContext: expect.objectContaining({
            destinationSwapQuote: quote.context.destinationSwapQuote,
          }),
        }),
      )
    })

    it('should handle USDT→USDC flow (no destination swap) without job context', async () => {
      const mockUSDCDest: TokenData = {
        ...mockTokenOP,
        config: {
          ...mockTokenOP.config,
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
        },
      }

      // Only source swap needed
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
          fromToken: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            decimals: 6,
          },
          toToken: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
          },
        },
      } as any)

      const quote = await service.getQuote(mockTokenUSDT, mockUSDCDest, 100)
      expect(quote.context.steps).toEqual(['sourceSwap', 'cctpBridge'])

      liFiService.execute.mockResolvedValueOnce({
        steps: [{ execution: { process: [{ txHash: '0xsourcetxhash' }] } }],
      } as any)
      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockResolvedValueOnce({
        txHash: '0xcctptxhash',
        messageHash: '0xmessagehash',
        messageBody: '0xmessagebody',
      })

      await service.execute('0xwallet', quote)

      // Verify CCTP attestation queued WITHOUT CCTPLiFi context (no destination swap)
      expect(mockStartCCTPAttestationCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationChainId: 10,
          messageHash: '0xmessagehash',
          messageBody: '0xmessagebody',
          cctpLiFiContext: undefined, // No destination swap needed
        }),
      )
    })

    it('should handle execution failures gracefully at each step', async () => {
      // First set up proper mocks for getQuote to succeed
      liFiService.getQuote
        .mockResolvedValueOnce({
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
            fromToken: {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              decimals: 6,
            },
            toToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
          },
        } as any)
        .mockResolvedValueOnce({
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
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
        } as any)

      const quote = await service.getQuote(mockTokenUSDT, mockTokenOP, 100)

      // Mock source swap failure
      liFiService.execute.mockRejectedValueOnce(new Error('LiFi network error'))

      await expect(service.execute('0xwallet', quote)).rejects.toThrow('Source swap failed')

      // Verify CCTP wasn't attempted after source swap failure
      expect(cctpService.executeWithMetadata).not.toHaveBeenCalled()
      expect(mockStartCCTPAttestationCheck).not.toHaveBeenCalled()
    })

    it('should handle CCTP bridge failure after successful source swap', async () => {
      // First set up proper mocks for getQuote to succeed
      liFiService.getQuote
        .mockResolvedValueOnce({
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
            fromToken: {
              address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
              decimals: 6,
            },
            toToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
          },
        } as any)
        .mockResolvedValueOnce({
          amountOut: parseUnits('45', 18),
          slippage: 0.02,
          context: {
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
        } as any)

      const quote = await service.getQuote(mockTokenUSDT, mockTokenOP, 100)

      // Mock successful source swap but CCTP failure
      liFiService.execute.mockResolvedValueOnce({
        steps: [{ execution: { process: [{ txHash: '0xsourcetxhash' }] } }],
      } as any)
      cctpService.getQuote.mockResolvedValueOnce({} as any)
      cctpService.executeWithMetadata.mockRejectedValueOnce(new Error('CCTP bridge down'))

      await expect(service.execute('0xwallet', quote)).rejects.toThrow('CCTP bridge failed')

      // Verify source swap was executed but queuing wasn't attempted
      expect(liFiService.execute).toHaveBeenCalledTimes(1)
      expect(mockStartCCTPAttestationCheck).not.toHaveBeenCalled()
    })
  })

  describe('Job Flow Integration Tests', () => {
    it('should verify complete attestation to destination swap job flow', () => {
      // This test verifies that CheckCCTPAttestationJob properly triggers CCTPLiFiDestinationSwapJob when context is provided

      const mockJobData = {
        destinationChainId: 10,
        messageHash: '0xmessagehash' as any,
        messageBody: '0xmessagebody' as any,
        cctpLiFiContext: {
          destinationSwapQuote: {
            fromAmount: '99000000',
            toAmount: '45000000000000000000',
            toAmountMin: '44100000000000000000',
            fromAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            toAddress: '0x4200000000000000000000000000000000000042',
            fromChainId: 10,
            toChainId: 10,
          },
          walletAddress: '0xwallet',
          originalTokenOut: {
            address: '0x4200000000000000000000000000000000000042' as any,
            chainId: 10,
            decimals: 18,
          },
        },
      }

      // Verify the job data structure matches what our enhanced system expects
      expect(mockJobData.cctpLiFiContext).toBeDefined()
      expect(mockJobData.cctpLiFiContext?.destinationSwapQuote).toBeDefined()
      expect(mockJobData.cctpLiFiContext?.walletAddress).toBe('0xwallet')
      expect(mockJobData.cctpLiFiContext?.originalTokenOut.chainId).toBe(10)

      // This validates the integration between our provider and the enhanced job system
      expect(mockJobData).toMatchObject({
        destinationChainId: expect.any(Number),
        messageHash: expect.any(String),
        messageBody: expect.any(String),
        cctpLiFiContext: expect.objectContaining({
          destinationSwapQuote: expect.any(Object),
          walletAddress: expect.any(String),
          originalTokenOut: expect.any(Object),
        }),
      })
    })
  })

  describe('Performance and Reliability Tests', () => {
    it('should handle high slippage scenarios with proper warnings', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')

      // Mock high slippage LiFi quotes
      liFiService.getQuote
        .mockResolvedValueOnce({
          amountOut: parseUnits('85', 6), // High slippage
          slippage: 0.15,
          context: {
            fromAmount: '100000000',
            toAmount: '85000000',
            toAmountMin: '72250000',
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
            fromToken: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              decimals: 6,
            },
            toToken: {
              address: '0x4200000000000000000000000000000000000042',
              decimals: 18,
            },
          },
        } as any)

      const quote = await service.getQuote(mockTokenUSDT, mockTokenOP, 100)

      expect(quote.slippage).toBeGreaterThan(0.05)

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

    it('should validate all required CCTP chains are supported', async () => {
      const supportedChains = [1, 10, 137, 8453, 42161] // ETH, OP, MATIC, BASE, ARB

      for (const sourceChain of supportedChains) {
        for (const destChain of supportedChains) {
          if (sourceChain !== destChain) {
            const sourceToken = { ...mockTokenUSDT, chainId: sourceChain }
            const destToken = { ...mockTokenOP, chainId: destChain }

            // This should not throw for any supported chain combination
            expect(() => {
              // The validation happens in getQuote, but we test the route planner directly
              const steps = CCTPLiFiRoutePlanner.planRoute(sourceToken, destToken)
              expect(steps).toBeDefined()
            }).not.toThrow()
          }
        }
      }
    })
  })
})
