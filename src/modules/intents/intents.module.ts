import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EventsModule } from '@/modules/events/events.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { Intent, IntentSchema } from './schemas/intent.schema';
import { IntentsService } from './intents.service';
import { IntentsEventsHandler } from './intents-events.handler';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Intent.name, schema: IntentSchema }]),
    EventsModule,
    RedisModule,
  ],
  providers: [IntentsService, IntentsEventsHandler],
  exports: [IntentsService],
})
export class IntentsModule {}
