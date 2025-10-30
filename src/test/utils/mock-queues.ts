import { getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'

export const createMockQueue = () => ({
  add: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPaused: jest.fn().mockResolvedValue(false),
  // used by queue utils in tests
  getJobSchedulers: jest.fn().mockResolvedValue([]),
  removeJobScheduler: jest.fn().mockResolvedValue(undefined),
  name: 'mock-queue',
})

export const createMockFlowProducer = () => ({
  addFlow: jest.fn(),
})

export function mockQueueProviders(...names: string[]) {
  return names.map((n) => ({
    provide: getQueueToken(n),
    useValue: createMockQueue(),
  }))
}

export function mockFlowProducerProviders(...names: string[]) {
  return names.map((n) => ({
    provide: getFlowProducerToken(n),
    useValue: createMockFlowProducer(),
  }))
}

export default {
  createMockQueue,
  createMockFlowProducer,
  mockQueueProviders,
  mockFlowProducerProviders,
}
