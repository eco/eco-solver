import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueModule } from '@/modules/queue/queue.module';

import { WithdrawalProcessor } from './withdrawal.processor';
import { WithdrawalScheduler } from './withdrawal.scheduler';
import { WithdrawalService } from './withdrawal.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueNames.INTENT_WITHDRAWAL,
    }),
    forwardRef(() => BlockchainModule),
    IntentsModule,
    QueueModule,
  ],
  providers: [WithdrawalService, WithdrawalProcessor, WithdrawalScheduler],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
