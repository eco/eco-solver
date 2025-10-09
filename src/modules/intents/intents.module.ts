import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EventsModule } from '@/modules/events/events.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { QuoteRepository } from './repositories/quote.repository';
import { Intent, IntentSchema } from './schemas/intent.schema';
import { Quote, QuoteSchema } from './schemas/quote.schema';
import { IntentsService } from './intents.service';
import { IntentsEventsHandler } from './intents-events.handler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Intent.name, schema: IntentSchema },
      { name: Quote.name, schema: QuoteSchema },
    ]),
    EventsModule,
    LoggingModule,
  ],
  providers: [IntentsService, IntentsEventsHandler, QuoteRepository],
  exports: [IntentsService, QuoteRepository],
})
export class IntentsModule {}
