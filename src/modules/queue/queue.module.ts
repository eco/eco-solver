import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { LoggingModule } from '@/modules/logging/logging.module';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueService } from '@/modules/queue/queue.service';
import { QueueMetricsService } from '@/modules/queue/queue-metrics.service';
import { RedisModule } from '@/modules/redis/redis.module';
import { RedisConnectionFactory } from '@/modules/redis/redis-connection.factory';

@Global()
@Module({
  imports: [
    LoggingModule,
    RedisModule,
    BullModule.registerQueueAsync(
      {
        name: QueueNames.INTENT_FULFILLMENT,
        imports: [RedisModule],
        useFactory: (connectionFactory: RedisConnectionFactory) => {
          return connectionFactory.getQueueConfig(QueueNames.INTENT_FULFILLMENT);
        },
        inject: [RedisConnectionFactory],
      },
      {
        name: QueueNames.INTENT_EXECUTION,
        imports: [RedisModule],
        useFactory: (connectionFactory: RedisConnectionFactory) => {
          return connectionFactory.getQueueConfig(QueueNames.INTENT_EXECUTION);
        },
        inject: [RedisConnectionFactory],
      },
      {
        name: QueueNames.INTENT_WITHDRAWAL,
        imports: [RedisModule],
        useFactory: (connectionFactory: RedisConnectionFactory) => {
          return connectionFactory.getQueueConfig(QueueNames.INTENT_WITHDRAWAL);
        },
        inject: [RedisConnectionFactory],
      },
      {
        name: QueueNames.BLOCKCHAIN_EVENTS,
        imports: [RedisModule],
        useFactory: (connectionFactory: RedisConnectionFactory) => {
          return connectionFactory.getQueueConfig(QueueNames.BLOCKCHAIN_EVENTS);
        },
        inject: [RedisConnectionFactory],
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
