import { Module } from '@nestjs/common'
import { IntentModule } from '../intent/intent.module'
import { TransactionModule } from '../transaction/transaction.module'
import { WatchModule } from '../watch/watch.module'
import { IntentCreatedChainSyncService } from './intent-created-chain-sync.service'
import { IntentFundedChainSyncService } from './intent-funded-chain-sync.service'

@Module({
  imports: [IntentModule, TransactionModule, WatchModule],
  providers: [IntentCreatedChainSyncService, IntentFundedChainSyncService],
  exports: [IntentCreatedChainSyncService, IntentFundedChainSyncService],
})
export class ChainMonitorModule {}
