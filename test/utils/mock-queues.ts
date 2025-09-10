import { getFlowProducerToken, getQueueToken } from '@nestjs/bullmq'

export const createMockQueue = () => ({
  add: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  isPaused: jest.fn().mockResolvedValue(false),
  // keep a name so some tests can inspect it if needed
  name: 'mock-queue',
})

export const createMockFlowProducer = () => ({
  addFlow: jest.fn(),
})

export function mockQueueProviders(...names: string[]) {
  return names.map((n) => ({ provide: getQueueToken(n), useValue: createMockQueue() }))
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
