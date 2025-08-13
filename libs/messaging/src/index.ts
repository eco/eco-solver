// Messaging library - minimal interface-only version
// This avoids TypeScript compilation issues with cross-app dependencies

// Core messaging service interfaces
export interface IMessageBroker {
  publish(topic: string, message: any): Promise<void>
  subscribe(topic: string, handler: (message: any) => void): Promise<void>
  unsubscribe(topic: string): Promise<void>
}

export interface IQueue {
  add(jobName: string, data: any, options?: any): Promise<void>
  process(jobName: string, processor: (job: any) => Promise<void>): void
}

export interface IEventPublisher {
  publishEvent(event: string, data: any): Promise<void>
}

export interface IEventSubscriber {
  subscribeToEvent(event: string, handler: (data: any) => void): Promise<void>
}

export interface IJobProcessor {
  processJob(job: any): Promise<void>
}

export interface IRedisService {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}
