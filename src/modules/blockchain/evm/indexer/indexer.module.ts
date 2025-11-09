import { Module } from '@nestjs/common';

import { LoggingModule } from '@/modules/logging/logging.module';

import { IndexerService } from './indexer.service';
import { IndexerConfigService } from './indexer-config.service';

@Module({
  imports: [LoggingModule],
  providers: [IndexerService, IndexerConfigService],
  exports: [IndexerService, IndexerConfigService],
})
export class IndexerModule {}
