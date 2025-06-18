import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QUEUES } from '@/common/redis/constants'
import { BalanceModule } from '@/balance/balance.module'
import { BalanceTrackerService } from './balance-tracker-mongo.service'
import { BalanceTrackerProcessor } from './processors/balance-tracker.processor'
import { TrackedBalance, TrackedBalanceSchema } from './schemas/tracked-balance.schema'
import { TrackedBalanceRepository } from './repositories/tracked-balance.repository'
import { initBullMQ } from '../bullmq/bullmq.helper'

/**
 * Module for balance tracking functionality using MongoDB for storage
 */
@Module({
  imports: [
    // Import BalanceModule for balance service access
    BalanceModule,
    // Import MongoDB schema for tracked balances
    MongooseModule.forFeature([{ name: TrackedBalance.name, schema: TrackedBalanceSchema }]),
    // Import BullMQ only for initialization jobs
    initBullMQ(QUEUES.BALANCE_MONITOR),
  ],
  providers: [BalanceTrackerService, BalanceTrackerProcessor, TrackedBalanceRepository],
  exports: [BalanceTrackerService, TrackedBalanceRepository],
})
export class BalanceMonitorModule {}
