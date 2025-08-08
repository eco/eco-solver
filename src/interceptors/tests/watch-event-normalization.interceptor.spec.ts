import { WatchEventNormalizationInterceptor } from '@/interceptors/watch-event-normalization.interceptor'
import { EcoError } from '@/common/errors/eco-error'

// Mock findTokenDecimals used inside token-normalization.utils.ts
jest.mock('@/interceptors/utils', () => ({
  findTokenDecimals: (token: string) => {
    const map: Record<string, number> = {
      '0xTokenA': 6, // e.g. USDC-like
      '0xTokenB': 8, // e.g. some 8-dec token
    }
    return map[token as keyof typeof map] ?? null
  },
}))

// Minimal shape resembling IntentCreatedLog for testing
type TestIntentCreatedLog = {
  args?: any
  [k: string]: any
}

describe('WatchEventNormalizationInterceptor', () => {
  let interceptor: WatchEventNormalizationInterceptor

  beforeEach(() => {
    interceptor = new WatchEventNormalizationInterceptor()
  })

  it('normalizes rewardTokens and routeTokens amounts to 18 decimals and adds decimal metadata', () => {
    const log: TestIntentCreatedLog = {
      args: {
        rewardTokens: [
          { token: '0xTokenA', amount: 1_000_000n }, // 1.0 with 6 decimals
        ],
        routeTokens: [
          { token: '0xTokenB', amount: 2_000_00000n }, // 2.0 with 8 decimals
        ],
        destination: BigInt(200),
      },
    }

    const normalized = interceptor.normalizeIntentCreatedLog(log as any, 100)

    // Reward token: 1 * 10^(18-6) = 1e12 scaling IF amount were 1 (raw). Here amount is 1_000_000 (6 decimals) => 1 token => 1e18 base units.
    expect(normalized.args.rewardTokens[0].amount).toBe(1_000_000_000_000_000_000n)
    expect((normalized.args.rewardTokens as any[])[0].decimals).toEqual({
      original: 6,
      current: 18,
    })

    // Route token: 2 * 10^(18-8) = 2e10 scaling IF amount were 2 (raw). Here amount is 200_000_000 (8 decimals) => 2 tokens => 2e18 base units.
    expect(normalized.args.routeTokens[0].amount).toBe(2_000_000_000_000_000_000n)
    expect((normalized.args.routeTokens as any[])[0].decimals).toEqual({ original: 8, current: 18 })
  })

  it('throws EcoError.UnknownTokenError if token decimals cannot be resolved', () => {
    const log: TestIntentCreatedLog = {
      args: {
        rewardTokens: [{ token: '0xUnknown', amount: 5n }],
        destination: BigInt(100),
      },
    }

    expect(() => interceptor.normalizeIntentCreatedLog(log as any, 100)).toThrow(EcoError)
  })

  it('returns original log if args missing', () => {
    const log: TestIntentCreatedLog = {}
    const normalized = interceptor.normalizeIntentCreatedLog(log as any, 100)
    expect(normalized).toBe(log)
  })
})
