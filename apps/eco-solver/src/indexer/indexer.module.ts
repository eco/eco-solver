import { Module } from '@nestjs/common'
import { IndexerService } from '@eco-solver/indexer/services/indexer.service'

@Module({
  imports: [],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
