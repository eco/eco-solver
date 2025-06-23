import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceRecord, BalanceRecordSchema } from './schemas/balance-record.schema'
import { BalanceRecordRepository } from './repositories/balance-record.repository'
import { BalanceService } from './services/balance.service'
import { TransactionModule } from '../transaction/transaction.module'
import { CacheModule } from '@nestjs/cache-manager'
import { RpcBalanceService } from './services/rpc-balance.service'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'

@Module({
  imports: [
    TransactionModule,
    CacheModule.register(),
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: BalanceRecord.name, schema: BalanceRecordSchema }]),
    initBullMQ(QUEUES.BALANCE_MONITOR),
  ],

  providers: [
    // Repositories
    BalanceRecordRepository,

    // Services
    RpcBalanceService,
    BalanceService,
  ],
  exports: [
    // Export services for use in other modules
    RpcBalanceService,
    BalanceService,
    BalanceRecordRepository,
  ],
})
export class BalanceModule {}
