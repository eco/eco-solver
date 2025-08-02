import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { QueueService } from '@/modules/queue/queue.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'intent-fulfillment',
      },
      {
        name: 'wallet-execution',
      },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
