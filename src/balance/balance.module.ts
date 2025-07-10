import { Module } from '@nestjs/common'
import { BalanceService } from './balance.service'
import { initBullMQ } from '../bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'
import { BalanceWebsocketService } from './balance.ws.service'
import { TransactionModule } from '../transaction/transaction.module'
import { CacheModule } from '@nestjs/cache-manager'
import { EvmBalanceService } from './services/evm-balance.service'
import { SvmBalanceService } from './services/svm-balance.service'

@Module({
  imports: [TransactionModule, initBullMQ(QUEUES.ETH_SOCKET), CacheModule.register()],
  providers: [BalanceService, BalanceWebsocketService, EvmBalanceService, SvmBalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
