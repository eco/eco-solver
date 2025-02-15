import { Module } from '@nestjs/common'
import { SignModule } from '@/sign/sign.module'
import { BalanceModule } from '@/balance/balance.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { IndexerModule } from '@/indexer/indexer.module'
import { WithdrawsQueue } from '@/withdraws/queues/withdraws.queue'
import { WithdrawsService } from '@/withdraws/services/withdraws.service'
import { WithdrawsProcessor } from '@/withdraws/processors/withdraws.processor'

@Module({
  imports: [BalanceModule, TransactionModule, IndexerModule, SignModule, WithdrawsQueue.init()],
  providers: [WithdrawsService, WithdrawsProcessor],
  exports: [],
})
export class WithdrawsModule {}
