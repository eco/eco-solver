import { BullMQModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentProcessor } from '@/modules/fulfillment/fulfillment.processor';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { StorageFulfillment } from '@/modules/fulfillment/fulfillments/storage.fulfillment';
import { BasicValidationStrategy } from '@/modules/fulfillment/strategies/basic-validation.strategy';
import { IntentsModule } from '@/modules/intents/intents.module';
import { QueueModule } from '@/modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    IntentsModule,
    QueueModule,
    BullMQModule.registerQueue({
      name: 'intent-fulfillment',
    }),
  ],
  providers: [
    FulfillmentService,
    FulfillmentProcessor,
    BasicValidationStrategy,
    StorageFulfillment,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
