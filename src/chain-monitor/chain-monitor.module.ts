import { Module } from '@nestjs/common'
import { IntentModule } from '../intent/intent.module'
import { ChainSyncService } from './chain-sync.service'
import { TransactionModule } from '../transaction/transaction.module'
import { WatchModule } from '@/watch/watch.module'

@Module({
  imports: [IntentModule, TransactionModule, WatchModule],
  providers: [ChainSyncService],
  exports: [ChainSyncService],
})
export class ChainMonitorModule {}
