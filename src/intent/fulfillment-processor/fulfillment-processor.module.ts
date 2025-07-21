import { FulfillmentProcessor } from '@/intent/fulfillment-processor/processors/fulfillment.processor'
import { FulfillmentProcessorQueue } from '@/intent/fulfillment-processor/queues/fulfillment-processor.queue'
import { FulfillmentProcessorService } from '@/intent/fulfillment-processor/services/fulfillment-processor.service'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'

@Module({
  imports: [
    // BalanceModule,
    // TransactionModule,
    // IndexerModule,
    // SignModule,
    IntentModule,
    FulfillmentProcessorQueue.init(),
  ],
  providers: [FulfillmentProcessorService, FulfillmentProcessor],
  exports: [FulfillmentProcessorService, FulfillmentProcessor],
})
export class FulfillmentProcessorModule {}
