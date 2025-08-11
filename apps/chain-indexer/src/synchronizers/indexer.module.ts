import { Module } from '@nestjs/common'
import { EcoConfigService, EcoAnalyticsService, ChainDataFetcherService } from '@libs/integrations'
import { IndexerDomainService, BatchProcessingService } from '@libs/domain'
import { IndexerService } from './services/indexer.service'

@Module({
  imports: [],
  providers: [
    EcoConfigService,
    EcoAnalyticsService,
    ChainDataFetcherService,
    IndexerDomainService,
    BatchProcessingService,
    IndexerService
  ],
  exports: [IndexerService],
})
export class IndexerModule {}
