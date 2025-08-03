import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueService } from '@/modules/queue/queue.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'intent-fulfillment',
      },
      {
        name: 'blockchain-execution',
      },
    ),
  ],
  providers: [
    QueueService,
    {
      provide: QUEUE_SERVICE,
      useClass: QueueService,
    },
  ],
  exports: [QueueService, BullModule, QUEUE_SERVICE],
})
export class QueueModule {}
