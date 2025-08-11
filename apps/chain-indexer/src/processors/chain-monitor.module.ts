import { Module } from '@nestjs/common'
import { MultichainPublicClientService, EcoConfigService, EcoAnalyticsService } from '@libs/integrations'
import { ChainSyncDomainService } from '@libs/domain'
import { ChainSyncMessageService } from '@libs/messaging'
import { WatchModule } from '../listeners/watch.module'
import { IntentCreatedChainSyncService } from './intent-created-chain-sync.service'
import { IntentFundedChainSyncService } from './intent-funded-chain-sync.service'

@Module({
  imports: [WatchModule],
  providers: [
    MultichainPublicClientService,
    EcoConfigService,
    EcoAnalyticsService,
    ChainSyncDomainService,
    ChainSyncMessageService,
    IntentCreatedChainSyncService,
    IntentFundedChainSyncService
  ],
  exports: [IntentCreatedChainSyncService, IntentFundedChainSyncService],
})
export class ChainMonitorModule {}
