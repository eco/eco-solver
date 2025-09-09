import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'

describe('CheckBalancesCronJobManager.process', () => {
  it('no deficits → does not call storeRebalancing/startRebalancing', async () => {
    const mgr = new CheckBalancesCronJobManager()

    const processor: any = {
      logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      liquidityManagerService: {
        analyzeTokens: jest
          .fn()
          .mockResolvedValue({ items: [], deficit: { total: 0 }, surplus: { items: [] } }),
        storeRebalancing: jest.fn(),
        startRebalancing: jest.fn(),
      },
    }

    const job: any = { name: 'CHECK_BALANCES', data: { wallet: '0xw' } }

    await mgr.process(job as any, processor as LiquidityManagerProcessor)

    expect(processor.liquidityManagerService.storeRebalancing).not.toHaveBeenCalled()
    expect(processor.liquidityManagerService.startRebalancing).not.toHaveBeenCalled()
  })
})

describe('CheckBalancesCronJobManager.process with quotes', () => {
  it('stores rebalances and starts batch once', async () => {
    const mgr = new CheckBalancesCronJobManager()

    const quotes = [
      {
        amountIn: 10n,
        amountOut: 9n,
        tokenIn: { balance: { decimals: 6 }, config: { address: '0xA', chainId: 1 } },
        tokenOut: {
          balance: { balance: 0n, decimals: 6 },
          config: { address: '0xB', chainId: 1, targetBalance: 100 },
        },
        slippage: 0.01,
        strategy: 'TEST',
      },
    ]

    const processor: any = {
      logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      liquidityManagerService: {
        analyzeTokens: jest.fn().mockResolvedValue({
          items: [],
          deficit: {
            total: 1,
            items: [
              {
                config: { chainId: 1, address: '0xB' },
                balance: { decimals: 6, balance: 0n },
                analysis: {
                  targetSlippage: { min: 1n },
                  balance: { current: 0n, target: 100n, minimum: 80n, maximum: 110n },
                  state: 'DEFICIT',
                },
              },
            ],
          },
          surplus: {
            items: [
              {
                config: { chainId: 1, address: '0xA' },
                balance: { decimals: 6, balance: 100n },
                analysis: {
                  diff: 10,
                  targetSlippage: { min: 90n },
                  balance: { current: 100n, target: 100n, minimum: 80n, maximum: 110n },
                  state: 'SURPLUS',
                },
              },
            ],
          },
        }),
        getOptimizedRebalancing: jest.fn().mockResolvedValue(quotes),
        storeRebalancing: jest.fn().mockResolvedValue(undefined),
        startRebalancing: jest.fn().mockResolvedValue(undefined),
        analyzeToken: jest.fn((t: any) => t.analysis),
      },
    }

    const job: any = { name: 'CHECK_BALANCES', data: { wallet: '0xw' } }

    await mgr.process(job as any, processor as LiquidityManagerProcessor)

    expect(processor.liquidityManagerService.storeRebalancing).toHaveBeenCalledTimes(1)
    expect(processor.liquidityManagerService.startRebalancing).toHaveBeenCalledTimes(1)
  })

  it('filters surplus to SURPLUS with diff>0 before each deficit call', async () => {
    const mgr = new CheckBalancesCronJobManager()

    // Surplus token that will be exhausted by first deficit
    const surplusToken = {
      config: { chainId: 1, address: '0xS', targetBalance: 50 },
      balance: { decimals: 6, balance: 60_000_000n },
      analysis: {
        state: 'SURPLUS',
        diff: 10,
        targetSlippage: { min: 49_000_000n, max: 51_000_000n },
        balance: {
          current: 60_000_000n,
          target: 50_000_000n,
          minimum: 40_000_000n,
          maximum: 55_000_000n,
        },
      },
    }
    // Non-usable surplus entries
    const inRangeToken = {
      config: { chainId: 1, address: '0xIR', targetBalance: 50 },
      balance: { decimals: 6, balance: 50_000_000n },
      analysis: {
        state: 'IN_RANGE',
        diff: 0,
        targetSlippage: { min: 49_000_000n, max: 51_000_000n },
        balance: {
          current: 50_000_000n,
          target: 50_000_000n,
          minimum: 40_000_000n,
          maximum: 55_000_000n,
        },
      },
    }

    // Two deficits to trigger two calls
    const deficit1 = {
      config: { chainId: 137, address: '0xD1', targetBalance: 50 },
      balance: { decimals: 6, balance: 10_000_000n },
      analysis: {
        state: 'DEFICIT',
        diff: 10,
        targetSlippage: { min: 49_000_000n, max: 51_000_000n },
        balance: {
          current: 10_000_000n,
          target: 50_000_000n,
          minimum: 40_000_000n,
          maximum: 55_000_000n,
        },
      },
    }
    const deficit2 = {
      config: { chainId: 137, address: '0xD2', targetBalance: 50 },
      balance: { decimals: 6, balance: 10_000_000n },
      analysis: {
        state: 'DEFICIT',
        diff: 10,
        targetSlippage: { min: 49_000_000n, max: 51_000_000n },
        balance: {
          current: 10_000_000n,
          target: 50_000_000n,
          minimum: 40_000_000n,
          maximum: 55_000_000n,
        },
      },
    }

    const processor: any = {
      logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
      liquidityManagerService: {
        analyzeTokens: jest.fn().mockResolvedValue({
          items: [],
          deficit: { total: 2, items: [deficit1, deficit2] },
          surplus: { items: [surplusToken, inRangeToken] },
        }),
        // First call: should receive only [surplusToken]
        // Return a quote that exhausts surplusToken: amountIn = 10_000_000, so balance hits target
        getOptimizedRebalancing: jest
          .fn()
          .mockImplementationOnce(async (_wallet: string, _def: any, usable: any[]) => {
            expect(usable).toHaveLength(1)
            expect(usable[0].config.address).toBe('0xS')
            return [
              {
                amountIn: 10_000_000n,
                amountOut: 9_000_000n,
                tokenIn: surplusToken,
                tokenOut: {
                  balance: { decimals: 6, balance: 0n },
                  config: { chainId: 137, address: '0xD1', targetBalance: 50 },
                },
                slippage: 0.01,
                strategy: 'TEST',
              },
            ] as any
          })
          // Second call: after updateGroupBalances, surplusToken becomes IN_RANGE → filtered out
          .mockImplementationOnce(async (_wallet: string, _def: any, usable: any[]) => {
            expect(usable).toHaveLength(0)
            return []
          }),
        storeRebalancing: jest.fn().mockResolvedValue(undefined),
        startRebalancing: jest.fn().mockResolvedValue(undefined),
        // Recompute analysis: IN_RANGE when current equals target, otherwise return prior state
        analyzeToken: jest.fn((t: any) => {
          const current = t.balance.balance
          const target = t.analysis?.balance?.target ?? 0n
          if (current === target) {
            return {
              state: 'IN_RANGE',
              diff: 0,
              targetSlippage: t.analysis.targetSlippage,
              balance: { ...t.analysis.balance, current },
            }
          }
          return t.analysis
        }),
      },
    }

    const job: any = { name: 'CHECK_BALANCES', data: { wallet: '0xw' } }

    await mgr.process(job as any, processor as LiquidityManagerProcessor)

    // Ensure both deficits were processed
    expect(processor.liquidityManagerService.getOptimizedRebalancing).toHaveBeenCalledTimes(2)
  })
})
