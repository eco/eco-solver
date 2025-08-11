import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { LoggingModule } from '@/modules/logging/logging.module';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/queue.service';
import { QueueMetricsService } from '@/modules/queue/queue-metrics.service';

@Global()
@Module({
  imports: [
    LoggingModule,
    BullModule.registerQueue(
      {
        name: QueueNames.INTENT_FULFILLMENT,
      },
      {
        name: QueueNames.INTENT_EXECUTION,
      },
    ),
  ],
  providers: [
    QueueService,
    QueueMetricsService,
    {
      provide: QUEUE_SERVICE,
      useClass: QueueService,
    },
  ],
  exports: [QueueService, BullModule, QUEUE_SERVICE],
})
export class QueueModule {}
