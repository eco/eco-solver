import { Module } from '@nestjs/common'
import { IndexerService } from '@/indexer/services/indexer.service'

@Module({
  imports: [],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
