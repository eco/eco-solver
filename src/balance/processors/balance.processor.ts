import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { BalanceChangeRepository } from '@/balance/repositories/balance-change.repository'
import { BalanceService } from '@/balance/services/balance.service'
import { BalanceRecordRepository } from '@/balance/repositories/balance-record.repository'
import {
  BALANCE_JOBS,
  UpdateBalanceJobData as UpdateBalanceChangeJobData,
  UpdateBalanceRecordJobData,
} from '@/balance/jobs/balance.job'

/**
 * BullMQ processor for balance tracking jobs
 * Handles initialization and balance update jobs
 */
@Injectable()
@Processor(QUEUES.BALANCE_MONITOR.queue)
export class BalanceProcessor extends WorkerHost {
  private readonly logger = new Logger(BalanceProcessor.name)

  constructor(
    private readonly balanceService: BalanceService,
    private readonly balanceRecordRepository: BalanceRecordRepository,
    private readonly balanceChangeRepository: BalanceChangeRepository,
  ) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `BalanceProcessor: Processing job`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        },
      }),
    )

    try {
      switch (job.name) {
        case BALANCE_JOBS.init_balance_record:
        case BALANCE_JOBS.update_balance_record:
          return await this.processUpdateBalanceRecord(job)

        case BALANCE_JOBS.update_balance_change:
          return await this.processUpdateBalanceChange(job)

        default:
          const errorMsg = `BalanceProcessor: Invalid job type ${job.name}`
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: errorMsg,
              properties: {
                jobName: job.name,
                jobId: job.id,
              },
            }),
          )
          throw new Error(errorMsg)
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `BalanceProcessor: Error processing job`,
          properties: {
            jobName: job.name,
            jobId: job.id,
            error: error.message,
            attempt: job.attemptsMade + 1,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Processes balance record update job - fetches current balances from RPC and updates records
   */
  private async processUpdateBalanceRecord(job: Job<UpdateBalanceRecordJobData>): Promise<void> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'BalanceProcessor: Processing balance record update from RPC',
        properties: {
          jobId: job.id,
        },
      }),
    )

    const startTime = Date.now()

    try {
      // Call the balance service method to update records from RPC
      await this.balanceService.updateBalanceRecordsFromRpc()

      const duration = Date.now() - startTime
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceProcessor: Balance records updated successfully from RPC',
          properties: {
            jobId: job.id,
            duration,
          },
        }),
      )
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceProcessor: Failed to update balance records from RPC',
          properties: {
            jobId: job.id,
            error: error.message,
            duration,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Processes balance update job from watch services
   */
  private async processUpdateBalanceChange(job: Job<UpdateBalanceChangeJobData>): Promise<void> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'BalanceProcessor: Processing balance update',
        properties: {
          jobId: job.id,
          chainId: job.data.chainId,
          address: job.data.address,
          changeAmount: job.data.changeAmount,
          direction: job.data.direction,
        },
      }),
    )

    const startTime = Date.now()

    try {
      // Create balance change using the repository directly
      await this.balanceChangeRepository.createBalanceChange({
        chainId: job.data.chainId,
        address: job.data.address,
        changeAmount: job.data.changeAmount,
        direction: job.data.direction,
        blockNumber: job.data.blockNumber,
        blockHash: job.data.blockHash,
        transactionHash: job.data.transactionHash,
        from: job.data.from,
        to: job.data.to,
      })

      const duration = Date.now() - startTime
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'BalanceProcessor: Balance change recorded successfully',
          properties: {
            jobId: job.id,
            chainId: job.data.chainId,
            address: job.data.address,
            changeAmount: job.data.changeAmount,
            direction: job.data.direction,
            transactionHash: job.data.transactionHash,
            duration,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceProcessor: Failed to process balance update',
          properties: {
            jobId: job.id,
            chainId: job.data.chainId,
            address: job.data.address,
            error: error.message,
            duration: Date.now() - startTime,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Handles job completion events
   */
  @OnWorkerEvent('completed')
  onJobCompleted(job: Job<any, any, string>, result: any) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `BalanceProcessor: Job completed`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          result: typeof result === 'object' ? JSON.stringify(result) : result,
        },
      }),
    )
  }

  /**
   * Handles job failure events
   */
  @OnWorkerEvent('failed')
  onJobFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `BalanceProcessor: Job failed`,
        properties: {
          jobName: job.name,
          jobId: job.id,
          error: error.message,
          attempt: job.attemptsMade,
          maxAttempts: job.opts.attempts,
        },
      }),
    )
  }

  /**
   * Handles job stalling events
   */
  @OnWorkerEvent('stalled')
  onJobStalled(jobId: string) {
    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `BalanceProcessor: Job stalled`,
        properties: {
          jobId,
        },
      }),
    )
  }
}
