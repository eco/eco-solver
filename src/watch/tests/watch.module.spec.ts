// Basic test to verify the WatchModule is properly defined
jest.mock('@/bullmq/bullmq.helper', () => ({
  initBullMQ: jest.fn().mockReturnValue({}),
}))

jest.mock('@/watch/intent/watch-create-intent.service')
jest.mock('@/watch/intent/watch-fulfillment.service')
jest.mock('@/transaction/transaction.module', () => ({
  TransactionModule: class {},
}))

import { WatchModule } from '../watch.module'

describe('WatchModule', () => {
  it('should be defined', () => {
    // Just verify the module class exists
    expect(WatchModule).toBeDefined()
  })
});