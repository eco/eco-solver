import { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { TokenDecimalsInterceptor } from '../token-decimals.interceptor'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { BASE_DECIMALS } from '@/intent/utils'
import * as tokenNormalizationUtils from '@/quote/utils/token-normalization.utils'

describe('TokenDecimalsInterceptor', () => {
  let interceptor: TokenDecimalsInterceptor
  let mockContext: ExecutionContext
  let mockCallHandler: CallHandler
  let mockRequest: any

  beforeEach(() => {
    interceptor = new TokenDecimalsInterceptor()
    mockRequest = {}
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext
    mockCallHandler = {
      handle: () => of({}),
    }

    // Mock the shared utility functions
    jest
      .spyOn(tokenNormalizationUtils, 'normalizeTokenAmounts')
      .mockImplementation((tokens: any[], chainId: number) => {
        return tokens.map((token) => {
          // Simulate unknown token error for test cases
          if (token.token === '0xunknown') {
            throw new Error(
              `Unknown token ${token.token} not found in @eco-foundation/chains for chain ${chainId}`,
            )
          }

          // Determine original decimals based on known tokens - USDC has 6 decimals on all chains
          const originalDecimals =
            token.token === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' ? 6 : BASE_DECIMALS

          // Always add decimals field regardless of whether token has BASE_DECIMALS or not
          return {
            ...token,
            amount: BigInt(token.amount) * BigInt(10 ** (BASE_DECIMALS - originalDecimals)),
            decimals: {
              original: originalDecimals,
              current: BASE_DECIMALS,
            },
          }
        })
      })

    jest
      .spyOn(tokenNormalizationUtils, 'denormalizeTokenAmounts')
      .mockImplementation((tokens: any[]) => {
        tokens.forEach((token) => {
          // Simulate unknown token error for test cases
          if (token.token === '0xunknown') {
            throw new Error(`Unknown token ${token.token} not found in @eco-foundation/chains`)
          }

          if (token.decimals) {
            // Simple mock reverse transformation - convert to string for JSON serialization
            const denormalizedAmount =
              BigInt(token.amount) /
              BigInt(10 ** (token.decimals.current - token.decimals.original))
            token.amount = denormalizedAmount.toString()
            delete token.decimals
          }
        })
      })
  })

  describe('Request Processing', () => {
    describe('reward tokens validation', () => {
      it('should throw error for unknown reward tokens', () => {
        mockRequest.body = {
          route: { source: 1, destination: 137, tokens: [] },
          reward: { tokens: [{ token: '0xunknown', amount: '1000' }] },
        } as unknown as QuoteIntentDataDTO

        expect(() => {
          interceptor.intercept(mockContext, mockCallHandler)
        }).toThrow('Unknown token 0xunknown not found in @eco-foundation/chains for chain 1')
      })
    })

    describe('route tokens validation', () => {
      it('should throw error for unknown route tokens', () => {
        mockRequest.body = {
          route: { source: 1, destination: 137, tokens: [{ token: '0xunknown', amount: '1000' }] },
          reward: { tokens: [] },
        } as unknown as QuoteIntentDataDTO

        expect(() => {
          interceptor.intercept(mockContext, mockCallHandler)
        }).toThrow('Unknown token 0xunknown not found in @eco-foundation/chains for chain 137')
      })
    })

    describe('decimals addition', () => {
      it('should add decimals field to known tokens', () => {
        mockRequest.body = {
          route: {
            source: 1,
            destination: 137,
            tokens: [{ token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', amount: '2000000' }],
          },
          reward: {
            tokens: [{ token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', amount: '1000000' }],
          },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        expect(mockRequest.body.reward.tokens[0].decimals).toEqual({
          original: 6,
          current: BASE_DECIMALS,
        })
        expect(mockRequest.body.route.tokens[0].decimals).toEqual({
          original: 6,
          current: BASE_DECIMALS,
        })
      })

      it('should add decimals field even for tokens with BASE_DECIMALS (18 decimals)', () => {
        mockRequest.body = {
          route: {
            source: 1,
            destination: 137,
            tokens: [{ token: '0xdefault18decimal', amount: '2000000' }],
          },
          reward: { tokens: [] },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        expect(mockRequest.body.route.tokens[0].decimals).toEqual({
          original: BASE_DECIMALS,
          current: BASE_DECIMALS,
        })
      })
    })

    describe('amount transformation', () => {
      it('should transform amounts from original to target decimals', () => {
        mockRequest.body = {
          route: { source: 1, destination: 137, tokens: [] },
          reward: {
            tokens: [{ token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', amount: '1000000' }],
          },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        const rewardToken = mockRequest.body.reward.tokens[0]
        expect(rewardToken.amount).toBe(1000000000000000000n)
      })

      it('should not transform amounts for tokens with BASE_DECIMALS decimals but still add decimals field', () => {
        mockRequest.body = {
          route: { source: 1, destination: 137, tokens: [] },
          reward: {
            tokens: [{ token: '0xdefault18decimal', amount: '1000000000000000000' }],
          },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        const rewardToken = mockRequest.body.reward.tokens[0]
        // Amount should remain the same (18 decimals to 18 decimals = no transformation)
        expect(rewardToken.amount).toBe(1000000000000000000n)
        // But decimals field should still be added
        expect(rewardToken.decimals).toEqual({
          original: BASE_DECIMALS,
          current: BASE_DECIMALS,
        })
      })
    })
  })

  describe('Response Processing', () => {
    describe('amount transformation', () => {
      it('should transform amounts back to original decimals in response', (done) => {
        const responseData = {
          quoteEntries: [
            {
              rewardTokens: [
                {
                  token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                  amount: '1000000000000000000',
                  decimals: { original: 6, current: BASE_DECIMALS },
                },
              ],
              routeTokens: [
                {
                  token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                  amount: '2000000000000000000',
                  decimals: { original: 6, current: BASE_DECIMALS },
                },
              ],
            },
          ],
        }

        mockCallHandler.handle = () => of(responseData)

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          const rewardToken = result.quoteEntries[0].rewardTokens[0]
          const routeToken = result.quoteEntries[0].routeTokens[0]
          expect(rewardToken.amount).toBe('1000000')
          expect(rewardToken.decimals).toBeUndefined()
          expect(routeToken.amount).toBe('2000000')
          expect(routeToken.decimals).toBeUndefined()
          done()
        })
      })

      it('should not transform amounts for tokens without decimals metadata', (done) => {
        const responseData = {
          quoteEntries: [
            {
              rewardTokens: [
                {
                  token: '0xdefault18decimal',
                  amount: '1000000000000000000',
                },
              ],
            },
          ],
        }

        mockCallHandler.handle = () => of(responseData)

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          const rewardToken = result.quoteEntries[0].rewardTokens[0]
          expect(rewardToken.amount).toBe('1000000000000000000')
          done()
        })
      })
    })

    describe('validation', () => {
      it('should throw error for unknown tokens in response', (done) => {
        const responseData = {
          quoteEntries: [
            {
              rewardTokens: [
                {
                  token: '0xunknown',
                  amount: '1000000000000000000',
                  decimals: { original: 6, current: BASE_DECIMALS },
                },
              ],
            },
          ],
        }

        mockCallHandler.handle = () => of(responseData)

        interceptor.intercept(mockContext, mockCallHandler).subscribe({
          next: () => {
            done(new Error('Expected error to be thrown'))
          },
          error: (err) => {
            expect(err.message).toContain(
              'Unknown token 0xunknown not found in @eco-foundation/chains',
            )
            done()
          },
        })
      })
    })

    describe('decimals cleanup', () => {
      it('should remove decimals metadata from response objects', (done) => {
        const responseData = {
          quoteEntries: [
            {
              rewardTokens: [
                {
                  token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                  amount: '1000000000000000000',
                  decimals: { original: 6, current: BASE_DECIMALS },
                },
              ],
            },
          ],
        }

        mockCallHandler.handle = () => of(responseData)

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          expect(result.quoteEntries[0].rewardTokens[0].decimals).toBeUndefined()
          done()
        })
      })
    })

    describe('JSON serialization', () => {
      it('should produce JSON serializable results without BigInt values', (done) => {
        // Use the real denormalizeTokenAmounts function instead of mock for this test
        jest.restoreAllMocks()

        const responseData = {
          quoteEntries: [
            {
              rewardTokens: [
                {
                  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                  amount: '750000000000000000',
                  decimals: { original: 6, current: 18 },
                },
              ],
              routeTokens: [
                {
                  token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
                  amount: '780000000000000000',
                  decimals: { original: 6, current: 18 },
                },
              ],
            },
          ],
        }

        mockCallHandler.handle = () => of(responseData)

        interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
          // Test that result can be JSON serialized without throwing BigInt error
          expect(() => JSON.stringify(result)).not.toThrow()

          // Verify amounts are strings, not BigInts
          expect(typeof result.quoteEntries[0].rewardTokens[0].amount).toBe('string')
          expect(typeof result.quoteEntries[0].routeTokens[0].amount).toBe('string')

          // Verify decimals metadata is removed
          expect(result.quoteEntries[0].rewardTokens[0].decimals).toBeUndefined()
          expect(result.quoteEntries[0].routeTokens[0].decimals).toBeUndefined()

          done()
        })
      })
    })
  })
})
