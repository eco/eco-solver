import { Module } from '@nestjs/common';
import { HatsService } from './hats.service';
import { EcoConfigModule } from '@/eco-configs/eco-config.module';
import { BalanceModule } from '@/balance/balance.module';
import { TransactionModule } from '@/transaction/transaction.module';

@Module({
  imports: [EcoConfigModule, BalanceModule, TransactionModule],

  providers: [HatsService],

  exports: [HatsService],
})
export class HatsModule { }