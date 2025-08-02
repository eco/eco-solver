import { BullMQModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { QueueService } from '@/modules/queue/queue.service';

@Global()
@Module({
  imports: [
    BullMQModule.registerQueue(
      {
        name: 'intent-fulfillment',
      },
      {
        name: 'wallet-execution',
      },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullMQModule],
})
export class QueueModule {}
