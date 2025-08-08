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
        return tokens.map(token => ({
          ...token,
          amount: BigInt(token.amount) * BigInt(10 ** (BASE_DECIMALS - (chainId === 1 ? 6 : BASE_DECIMALS))), // Simple mock transformation
          decimals: {
            original: chainId === 1 ? 6 : BASE_DECIMALS,
            current: BASE_DECIMALS
          }
        }))
      })
      
    jest
      .spyOn(tokenNormalizationUtils, 'denormalizeTokenAmounts')
      .mockImplementation((tokens: any[]) => {
        tokens.forEach(token => {
          if (token.decimals) {
            // Simple mock reverse transformation
            token.amount = BigInt(token.amount) / BigInt(10 ** (token.decimals.current - token.decimals.original))
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

      it('should not add decimals field for tokens with default BASE_DECIMALS decimals', () => {
        mockRequest.body = {
          route: {
            source: 1,
            destination: 137,
            tokens: [{ token: '0xdefault18decimal', amount: '2000000' }],
          },
          reward: { tokens: [] },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        expect(mockRequest.body.route.tokens[0].decimals).toBeUndefined()
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

      it('should not transform amounts for tokens with default BASE_DECIMALS decimals', () => {
        mockRequest.body = {
          route: { source: 1, destination: 137, tokens: [] },
          reward: {
            tokens: [{ token: '0xdefault18decimal', amount: '1000000000000000000' }],
          },
        } as unknown as QuoteIntentDataDTO

        interceptor.intercept(mockContext, mockCallHandler)

        const rewardToken = mockRequest.body.reward.tokens[0]
        expect(rewardToken.amount).toBe('1000000000000000000')
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
          expect(rewardToken.amount).toBe(1000000n)
          expect(rewardToken.decimals).toBeUndefined()
          expect(routeToken.amount).toBe(2000000n)
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
              'Unknown token 0xunknown not found in @eco-foundation/chains for chain 1',
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
  })
})
