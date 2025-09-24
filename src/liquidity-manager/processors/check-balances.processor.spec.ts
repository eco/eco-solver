// Mock the problematic dependencies first
jest.mock('@/liquidity-manager/queues/liquidity-manager.queue', () => ({
  LiquidityManagerQueue: {
    queueName: 'test-queue-name',
  },
  LiquidityManagerJobName: {
    CHECK_BALANCES: 'CHECK_BALANCES',
  },
}))

jest.mock('@/liquidity-manager/jobs/check-balances-cron.job', () => ({
  CheckBalancesCronJobManager: jest.fn().mockImplementation(() => ({
    process: jest.fn(),
    is: jest.fn().mockImplementation((job) => job.name === 'CHECK_BALANCES'),
  })),
}))

jest.mock('@/liquidity-manager/services/liquidity-manager.service', () => ({
  LiquidityManagerService: class MockLiquidityManagerService {},
}))

jest.mock('@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service', () => ({
  CCTPProviderService: class MockCCTPProviderService {},
}))

jest.mock(
  '@/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service',
  () => ({
    CCTPV2ProviderService: class MockCCTPV2ProviderService {},
  }),
)

import { CheckBalancesProcessor } from '@/liquidity-manager/processors/check-balances.processor'
import { LiquidityManagerJobName } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'

describe('CheckBalancesProcessor', () => {
  it('routes CHECK_BALANCES job to CheckBalancesCronJobManager.process', async () => {
    const processor = new CheckBalancesProcessor({} as any as LiquidityManagerService)

    const jobManagers = (processor as any).jobManagers as CheckBalancesCronJobManager[]
    expect(Array.isArray(jobManagers)).toBe(true)
    expect(jobManagers.length).toBeGreaterThan(0)

    const manager = jobManagers[0]
    const spy = jest.spyOn(manager, 'process').mockResolvedValue(undefined as any)

    const job: any = {
      name: LiquidityManagerJobName.CHECK_BALANCES,
      data: { wallet: '0x0000000000000000000000000000000000000000' },
    }

    await processor.process(job)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(job, processor)
  })

  it('does not route unrelated job names', async () => {
    const processor = new CheckBalancesProcessor({} as any as LiquidityManagerService)

    const job: any = {
      name: 'OTHER_JOB',
      data: {},
    }

    // Should not throw and should not call any job manager
    const jobManagers = (processor as any).jobManagers as CheckBalancesCronJobManager[]
    const spies = jobManagers.map((m) => jest.spyOn(m, 'process'))

    await processor.process(job)

    spies.forEach((s) => expect(s).not.toHaveBeenCalled())
  })
})
