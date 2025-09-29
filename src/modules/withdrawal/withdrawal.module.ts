import { forwardRef, Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { WithdrawalProcessor } from './withdrawal.processor';
import { WithdrawalScheduler } from './withdrawal.scheduler';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [
    forwardRef(() => BlockchainModule),
    IntentsModule,
    OpenTelemetryModule,
    QueueModule,
    RedisModule,
  ],
  providers: [WithdrawalService, WithdrawalProcessor, WithdrawalScheduler],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
