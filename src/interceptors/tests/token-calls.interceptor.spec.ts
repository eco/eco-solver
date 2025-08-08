import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { TokenCallsInterceptor } from '../token-calls.interceptor'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteError } from '@/quote/errors'
import { getERC20Selector } from '@/contracts'
import { Hex } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import * as interceptorUtils from '../utils'

// Mock the utils module
jest.mock('../utils')
const mockedFindTokenDecimals = jest.mocked(interceptorUtils.findTokenDecimals)

// Mock EcoConfigService
const mockEcoConfigService = {
  getSolver: jest.fn(),
}

describe('TokenCallsInterceptor', () => {
  let interceptor: TokenCallsInterceptor
  let mockExecutionContext: ExecutionContext
  let mockCallHandler: CallHandler
  let mockRequest: any

  // Helper function to create complete QuoteIntentDataDTO
  const createQuoteIntentData = (overrides: any = {}): QuoteIntentDataDTO => ({
    quoteID: 'test-quote-id',
    dAppID: 'test-dapp-id',
    intentExecutionTypes: ['MANUAL'],
    route: {
      source: 1n,
      destination: 1n,
      inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
      calls: [],
      tokens: [],
    },
    reward: {
      creator: '0x123',
      prover: '0x456',
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      tokens: [],
      nativeValue: 0n,
    },
    ...overrides,
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCallsInterceptor,
        {
          provide: EcoConfigService,
          useValue: mockEcoConfigService,
        },
      ],
    }).compile()

    interceptor = module.get<TokenCallsInterceptor>(TokenCallsInterceptor)

    mockRequest = {
      body: {},
    }

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext

    mockCallHandler = {
      handle: () => of({ success: true }),
    } as CallHandler

    // Reset mocks
    jest.clearAllMocks()

    // Setup default solver mock
    mockEcoConfigService.getSolver.mockReturnValue({
      chainID: 1,
      targets: {
        '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892': {
          contractType: 'erc20',
          selectors: ['0xa9059cbb'],
          minBalance: BigInt('1000000000000000000'),
          targetBalance: BigInt('100000000000000000000'),
        },
      },
    })
  })

  describe('Request Processing', () => {
    it('should add parsedCalls to request body and remove from response', (done) => {
      const transferSelector = getERC20Selector('transfer')
      const recipient = '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86'
      const amount = '1000000000000000000' // 1 token in 18 decimals

      // Create call data for ERC20 transfer
      const callData =
        transferSelector +
        '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' + // recipient (padded to 32 bytes)
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000' // 1e18 amount

      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              data: callData as Hex,
              value: 0n,
            },
          ],
          tokens: [
            {
              token: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              amount: BigInt(amount),
            },
          ],
        },
      })

      mockRequest.body = quoteIntentData

      // Mock token decimals lookup
      mockedFindTokenDecimals.mockReturnValue(18)

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      result$.subscribe((result) => {
        // Verify parsedCalls was added to request body
        expect((mockRequest.body as any).parsedCalls).toBeDefined()
        expect((mockRequest.body as any).parsedCalls.erc20Calls).toHaveLength(1)
        expect((mockRequest.body as any).parsedCalls.erc20Calls[0]).toEqual({
          token: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
          amount: BigInt(amount),
          recipient: '0x742d35cc6634c0532925A3b8D2c9e2A0FC7bda86', // Use the actual returned value
          value: 0n,
        })

        // Verify parsedCalls was removed from response
        expect(result).toEqual({ success: true })
        expect('parsedCalls' in result).toBe(false)

        done()
      })
    })

    it('should handle native calls', (done) => {
      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
              data: '0x',
              value: BigInt('1000000000000000000'), // 1 ETH
            },
          ],
          tokens: [],
        },
      })

      mockRequest.body = quoteIntentData

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      result$.subscribe((result) => {
        const parsedCalls = (mockRequest.body as any).parsedCalls
        expect(parsedCalls).toBeDefined()
        expect(parsedCalls.erc20Calls).toHaveLength(0)
        expect(parsedCalls.nativeCalls).toHaveLength(1)
        expect(parsedCalls.nativeCalls[0]).toEqual({
          recipient: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          value: BigInt('1000000000000000000'),
        })

        done()
      })
    })

    it('should throw error when call token is not in route tokens', () => {
      const transferSelector = getERC20Selector('transfer')
      const callData =
        transferSelector +
        '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' +
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000'

      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              data: callData as Hex,
              value: 0n,
            },
          ],
          tokens: [], // Empty tokens array
        },
      })

      mockRequest.body = quoteIntentData
      mockedFindTokenDecimals.mockReturnValue(18)

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      }).toThrow()
    })

    it('should throw error when call amount does not match token amount', () => {
      const transferSelector = getERC20Selector('transfer')
      const callData =
        transferSelector +
        '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' +
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000' // 1e18

      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              data: callData as Hex,
              value: 0n,
            },
          ],
          tokens: [
            {
              token: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              amount: BigInt('2000000000000000000'), // 2e18 - different amount
            },
          ],
        },
      })

      mockRequest.body = quoteIntentData
      mockedFindTokenDecimals.mockReturnValue(18)

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      }).toThrow()
    })

    it('should throw error when token is not found in calls', () => {
      // Create a call for a different token than what's in the tokens array
      const transferSelector = getERC20Selector('transfer')
      const callData =
        transferSelector +
        '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' +
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000'

      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              data: callData as Hex,
              value: 0n,
            },
          ],
          tokens: [
            {
              token: '0x1234567890123456789012345678901234567890', // Different token
              amount: BigInt('1000000000000000000'),
            },
          ],
        },
      })

      mockRequest.body = quoteIntentData
      mockedFindTokenDecimals.mockReturnValue(18)

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      }).toThrow()
    })

    it('should throw error when token decimals cannot be found', () => {
      const transferSelector = getERC20Selector('transfer')
      const callData =
        transferSelector +
        '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' +
        '0000000000000000000000000000000000000000000000000de0b6b3a7640000'

      const quoteIntentData = createQuoteIntentData({
        route: {
          source: 1n,
          destination: 1n,
          inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
          calls: [
            {
              target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              data: callData as Hex,
              value: 0n,
            },
          ],
          tokens: [
            {
              token: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
              amount: BigInt('1000000000000000000'),
            },
          ],
        },
      })

      mockRequest.body = quoteIntentData
      mockedFindTokenDecimals.mockReturnValue(null) // Token not found

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler)
      }).toThrow()
    })

    it('should handle request without route or calls', (done) => {
      const quoteIntentData = createQuoteIntentData({})

      mockRequest.body = quoteIntentData

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

      result$.subscribe((result) => {
        // Should not add parsedCalls if no route
        expect((mockRequest.body as any).parsedCalls).toBeUndefined()
        expect(result).toEqual({ success: true })
        done()
      })
    })

    describe('Solver Configuration Validation', () => {
      it('should throw error when target is not in solver configuration', () => {
        const transferSelector = getERC20Selector('transfer')
        const callData =
          transferSelector +
          '000000000000000000000000742d35cc6634c0532925a3b8d2c9e2a0fc7bda86' +
          '0000000000000000000000000000000000000000000000000de0b6b3a7640000'

        const quoteIntentData = createQuoteIntentData({
          route: {
            source: 1n,
            destination: 1n,
            inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
            calls: [
              {
                target: '0x0000000000000000000000000000000000000000', // Target not in solver config
                data: callData as Hex,
                value: 0n,
              },
            ],
            tokens: [
              {
                token: '0x0000000000000000000000000000000000000000',
                amount: BigInt('1000000000000000000'),
              },
            ],
          },
        })

        mockRequest.body = quoteIntentData
        mockedFindTokenDecimals.mockReturnValue(18)

        expect(() => {
          interceptor.intercept(mockExecutionContext, mockCallHandler)
        }).toThrow()
      })

      it('should throw InvalidFunctionCall error for ERC20 target with invalid call data', () => {
        const quoteIntentData = createQuoteIntentData({
          route: {
            source: 1n,
            destination: 1n,
            inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
            calls: [
              {
                target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
                data: '0x12345678', // Invalid call data for ERC20 transfer
                value: 0n,
              },
            ],
            tokens: [
              {
                token: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
                amount: BigInt('1000000000000000000'),
              },
            ],
          },
        })

        mockRequest.body = quoteIntentData
        mockedFindTokenDecimals.mockReturnValue(18)

        expect(() => {
          interceptor.intercept(mockExecutionContext, mockCallHandler)
        }).toThrow()
      })

      it('should validate non-ERC20 targets without checking call data', (done) => {
        // Setup solver with non-ERC20 target
        mockEcoConfigService.getSolver.mockReturnValue({
          chainID: 1,
          targets: {
            '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892': {
              contractType: 'erc721',
              selectors: ['0x23b872dd'],
              minBalance: BigInt('1000000000000000000'),
              targetBalance: BigInt('100000000000000000000'),
            },
          },
        })

        const quoteIntentData = createQuoteIntentData({
          route: {
            source: 1n,
            destination: 1n,
            inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
            calls: [
              {
                target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
                data: '0x12345678', // Some call data
                value: 0n,
              },
            ],
            tokens: [],
          },
        })

        mockRequest.body = quoteIntentData

        const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler)

        result$.subscribe((result) => {
          // Should not throw error for non-ERC20 targets
          expect(result).toEqual({ success: true })
          done()
        })
      })

      it('should throw NoSolverForDestination when solver is not found', () => {
        mockEcoConfigService.getSolver.mockReturnValue(null)

        const quoteIntentData = createQuoteIntentData({
          route: {
            source: 1n,
            destination: 999n, // Chain with no solver
            inbox: '0x742d35Cc6634C0532925a3b8D2C9e2A0Fc7BDA86',
            calls: [
              {
                target: '0xA0b86a33E6441c7c7c73a6F7E5b20F58C0F5a892',
                data: '0x',
                value: 0n,
              },
            ],
            tokens: [],
          },
        })

        mockRequest.body = quoteIntentData

        expect(() => {
          interceptor.intercept(mockExecutionContext, mockCallHandler)
        }).toThrow()
      })
    })
  })

  describe('Response Transformation', () => {
    it('should remove parsedCalls from single object response', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)
      const responseData = {
        quoteID: 'test-id',
        parsedCalls: {
          erc20Calls: [],
          nativeCalls: [],
        },
        other: 'data',
      }

      // Access the private method for testing
      const result = (interceptor as any).transformOutgoingResponse(responseData)

      expect(result).toEqual({
        quoteID: 'test-id',
        other: 'data',
      })
      expect('parsedCalls' in result).toBe(false)
    })

    it('should remove parsedCalls from array response', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)
      const responseData = [
        {
          quoteID: 'test-id-1',
          parsedCalls: { erc20Calls: [], nativeCalls: [] },
          data: 'first',
        },
        {
          quoteID: 'test-id-2',
          parsedCalls: { erc20Calls: [], nativeCalls: [] },
          data: 'second',
        },
      ]

      const result = (interceptor as any).transformOutgoingResponse(responseData)

      expect(result).toEqual([
        { quoteID: 'test-id-1', data: 'first' },
        { quoteID: 'test-id-2', data: 'second' },
      ])
      result.forEach((item: any) => {
        expect('parsedCalls' in item).toBe(false)
      })
    })

    it('should handle response without parsedCalls', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)
      const responseData = {
        quoteID: 'test-id',
        data: 'some-data',
      }

      const result = (interceptor as any).transformOutgoingResponse(responseData)

      expect(result).toEqual(responseData)
    })

    it('should handle array response with mixed objects', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)
      const responseData = [
        {
          quoteID: 'test-id-1',
          parsedCalls: { erc20Calls: [], nativeCalls: [] },
          data: 'first',
        },
        {
          quoteID: 'test-id-2',
          data: 'second',
          // No parsedCalls field
        },
      ]

      const result = (interceptor as any).transformOutgoingResponse(responseData)

      expect(result).toEqual([
        { quoteID: 'test-id-1', data: 'first' },
        { quoteID: 'test-id-2', data: 'second' },
      ])
    })

    it('should handle null/undefined response', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)

      expect((interceptor as any).transformOutgoingResponse(null)).toBe(null)
      expect((interceptor as any).transformOutgoingResponse(undefined)).toBe(undefined)
    })

    it('should handle primitive response types', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)

      expect((interceptor as any).transformOutgoingResponse('string')).toBe('string')
      expect((interceptor as any).transformOutgoingResponse(123)).toBe(123)
      expect((interceptor as any).transformOutgoingResponse(true)).toBe(true)
    })

    it('should handle nested objects without parsedCalls', () => {
      const interceptor = new TokenCallsInterceptor(mockEcoConfigService)
      const responseData = {
        quotes: [
          { id: '1', data: 'first' },
          { id: '2', data: 'second' },
        ],
        meta: { total: 2 },
      }

      const result = (interceptor as any).transformOutgoingResponse(responseData)

      expect(result).toEqual(responseData)
    })
  })
})
