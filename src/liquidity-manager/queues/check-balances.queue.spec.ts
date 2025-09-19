// Mock the problematic dependencies first
jest.mock('@/liquidity-manager/jobs/check-balances-cron.job', () => ({
  CheckBalancesCronJobManager: {
    start: jest.fn(),
  },
}))

jest.mock('@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service', () => ({
  CCTPProviderService: class MockCCTPProviderService {},
}))

import { Queue } from 'bullmq'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { CheckBalancesCronJobManager } from '@/liquidity-manager/jobs/check-balances-cron.job'

describe('CheckBalancesQueue', () => {
  it('startCronJobs delegates to CheckBalancesCronJobManager.start with correct args', async () => {
    const q = { name: 'test-queue' } as unknown as Queue
    const wrapper = new CheckBalancesQueue(q)

    const spy = jest.spyOn(CheckBalancesCronJobManager, 'start').mockResolvedValue(undefined as any)

    await wrapper.startCronJobs(1234, '0xwallet')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(q, 1234, '0xwallet')
  })
})
