import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { EventsService } from './events.service';

/**
 * Global module that provides type-safe event emitting capabilities
 * This module wraps the standard EventEmitter2 with our typed service
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Configure event emitter options
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  providers: [EventsService],
  exports: [EventsService, EventEmitterModule],
})
export class EventsModule {}