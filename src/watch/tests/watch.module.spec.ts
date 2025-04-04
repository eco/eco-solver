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

// Need to override the Module decorator to avoid circular dependency issues
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common')
  return {
    ...actual,
    Module: jest.fn().mockImplementation(() => {
      return () => {}
    }),
  }
})

describe('WatchModule', () => {
  it('should be defined', () => {
    // Just verify the module class exists
    expect(WatchModule).toBeDefined()
  })
})
