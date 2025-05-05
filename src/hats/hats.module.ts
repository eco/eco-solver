import { Module } from '@nestjs/common';
import { HatsService } from './hats.service';
import { BalanceModule } from '@/balance/balance.module';
import { TransactionModule } from '@/transaction/transaction.module';

@Module({
  imports: [BalanceModule, TransactionModule],

  providers: [HatsService],

  exports: [HatsService],
})
export class HatsModule { }