import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EventsModule } from '@/modules/events/events.module';
import { IntentRepository } from '@/modules/intents/repositories/intent.repository';
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
  providers: [IntentsService, IntentRepository, IntentsEventsHandler, QuoteRepository],
  exports: [IntentsService, IntentRepository, QuoteRepository],
})
export class IntentsModule {}
