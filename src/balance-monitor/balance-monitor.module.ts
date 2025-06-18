import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceTrackerService } from './balance-tracker-bullmq.service'
import { BalanceTrackerProcessor } from './processors/balance-tracker.processor'
import { initBullMQ } from '../bullmq/bullmq.helper'

/**
 * Module for balance tracking functionality
 */
@Module({
  imports: [
    // Import BalanceModule for balance service access
    BalanceModule,
    initBullMQ(QUEUES.BALANCE_MONITOR),
  ],
  providers: [BalanceTrackerService, BalanceTrackerProcessor],
  exports: [BalanceTrackerService],
})
export class BalanceMonitorModule {}
