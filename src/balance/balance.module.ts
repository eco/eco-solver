import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceRecord, BalanceRecordSchema } from './schemas/balance-record.schema'
import { BalanceChange, BalanceChangeSchema } from './schemas/balance-change.schema'
import { BalanceRecordRepository } from './repositories/balance-record.repository'
import { BalanceChangeRepository } from './repositories/balance-change.repository'
import { BalanceService } from './services/balance.service'
import { RpcBalanceService } from './services/rpc-balance.service'
import { BalanceProcessor } from './processors/balance.processor'
import { TransactionModule } from '../transaction/transaction.module'
import { CacheModule } from '@nestjs/cache-manager'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'
import { IntentSourceRepository } from '../intent/repositories/intent-source.repository'
import { IntentSourceModel, IntentSourceSchema } from '../intent/schemas/intent-source.schema'

@Module({
  imports: [
    TransactionModule,
    CacheModule.register(),
    // MongoDB schema registration
    MongooseModule.forFeature([
      { name: BalanceRecord.name, schema: BalanceRecordSchema },
      { name: BalanceChange.name, schema: BalanceChangeSchema },
      { name: IntentSourceModel.name, schema: IntentSourceSchema },
    ]),
    initBullMQ(QUEUES.BALANCE_MONITOR),
  ],

  providers: [
    // Repositories
    BalanceRecordRepository,
    BalanceChangeRepository,
    IntentSourceRepository,

    // Services
    RpcBalanceService,
    BalanceService,

    // Processors
    BalanceProcessor,
  ],
  exports: [
    // Export services for use in other modules
    RpcBalanceService,
    BalanceService,
    BalanceRecordRepository,
    BalanceChangeRepository,
  ],
})
export class BalanceModule {}
