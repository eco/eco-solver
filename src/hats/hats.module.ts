import { Module } from '@nestjs/common';
import { HatsService } from './hats.service';
import { BalanceModule } from '@/balance/balance.module';
import { TransactionModule } from '@/transaction/transaction.module';
import { initBullMQ } from '@/bullmq/bullmq.helper';
import { QUEUES } from '@/common/redis/constants';

@Module({
  imports: [
    BalanceModule,
    TransactionModule,
    initBullMQ(QUEUES.HATS)
  ],

  providers: [HatsService],

  exports: [HatsService],
})
export class HatsModule { }