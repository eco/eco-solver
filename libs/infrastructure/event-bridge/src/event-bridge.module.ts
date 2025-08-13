import { DynamicModule, Global, Module } from '@nestjs/common'
import { EventBridgeService } from './event-bridge.service'
import { EventPublisherConfig } from './publishers/event-publisher'

export interface EventBridgeModuleOptions extends EventPublisherConfig {
  global?: boolean
}

@Global()
@Module({})
export class EventBridgeModule {
  static forRoot(options: EventBridgeModuleOptions): DynamicModule {
    return {
      module: EventBridgeModule,
      providers: [
        {
          provide: 'EVENT_BRIDGE_CONFIG',
          useValue: options
        },
        {
          provide: EventBridgeService,
          useFactory: (config: EventPublisherConfig) => {
            return new EventBridgeService(config)
          },
          inject: ['EVENT_BRIDGE_CONFIG']
        }
      ],
      exports: [EventBridgeService],
      global: options.global !== false
    }
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => EventBridgeModuleOptions | Promise<EventBridgeModuleOptions>
    inject?: any[]
  }): DynamicModule {
    return {
      module: EventBridgeModule,
      providers: [
        {
          provide: 'EVENT_BRIDGE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || []
        },
        {
          provide: EventBridgeService,
          useFactory: (config: EventPublisherConfig) => {
            return new EventBridgeService(config)
          },
          inject: ['EVENT_BRIDGE_CONFIG']
        }
      ],
      exports: [EventBridgeService],
      global: true
    }
  }
}