import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EventsModule } from '@/modules/events/events.module';

import { Intent, IntentSchema } from './schemas/intent.schema';
import { IntentsService } from './intents.service';
import { IntentsEventsHandler } from './intents-events.handler';

@Module({
  imports: [MongooseModule.forFeature([{ name: Intent.name, schema: IntentSchema }]), EventsModule],
  providers: [IntentsService, IntentsEventsHandler],
  exports: [IntentsService],
})
export class IntentsModule {}
