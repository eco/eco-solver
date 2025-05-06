import { Module } from '@nestjs/common'
import { IndexerService } from '@/indexer/services/indexer.service'
import { SolanaIndexerService } from '@/indexer/services/solana-indexer.service'

@Module({
  imports: [],
  providers: [IndexerService, SolanaIndexerService],
  exports: [IndexerService, SolanaIndexerService],
})
export class IndexerModule {}
