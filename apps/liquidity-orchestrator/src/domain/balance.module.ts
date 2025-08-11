import { Module, CacheModule } from '@nestjs/common'
import { BalanceService } from './balance.service'
import { BalanceWebsocketService } from './balance.ws.service'
import { TransactionModule } from '@libs/integrations'
import { initBullMQ, QUEUES } from '@libs/messaging'

@Module({
  imports: [TransactionModule, initBullMQ(QUEUES.ETH_SOCKET), CacheModule.register()],
  providers: [BalanceService, BalanceWebsocketService],
  exports: [BalanceService],
})
export class BalanceModule {}
