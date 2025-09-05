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
})
