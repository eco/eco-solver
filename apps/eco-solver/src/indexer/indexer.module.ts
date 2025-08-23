import { Module } from '@nestjs/common'
import { IndexerService } from './services/indexer.service'

@Module({
  imports: [],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
