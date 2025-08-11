import { Module } from '@nestjs/common'
import { WatchModule } from './listeners/watch.module'
import { ChainMonitorModule } from './processors/chain-monitor.module'
import { IndexerModule } from './synchronizers/indexer.module'

@Module({
  imports: [
    WatchModule,
    ChainMonitorModule,
    IndexerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
