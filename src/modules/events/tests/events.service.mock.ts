import { EventMap } from '@/common/events/event-map';

/**
 * Mock EventsService for testing
 * Provides type-safe mock methods that match the EventsService interface
 */
export const createMockEventsService = () => ({
  emit: jest.fn<boolean, [keyof EventMap, EventMap[keyof EventMap]]>(),
  emitAsync: jest.fn<Promise<any[]>, [keyof EventMap, EventMap[keyof EventMap]]>(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  addListener: jest.fn(),
  getEmitter: jest.fn(),
  eventNames: jest.fn(),
  listeners: jest.fn(),
  listenerCount: jest.fn(),
});
