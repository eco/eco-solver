import { Module } from '@nestjs/common'
import { BalanceService } from './balance.service'
import { QUEUES } from '../common/redis/constants'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { BalanceWebsocketService } from './balance.ws.service'
import { TransactionModule } from '../transaction/transaction.module'
import { CacheModule } from '@nestjs/cache-manager'

@Module({
  imports: [TransactionModule, initBullMQ(QUEUES.ETH_SOCKET), CacheModule.register()],
  providers: [BalanceService, BalanceWebsocketService],
  exports: [BalanceService],
})
export class BalanceModule {}
