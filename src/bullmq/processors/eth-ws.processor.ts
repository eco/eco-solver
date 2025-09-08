import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { BalanceService } from '../../balance/balance.service'
import { ViemEventLog } from '../../common/events/viem'

@Injectable()
@Processor(QUEUES.ETH_SOCKET.queue)
export class EthWebsocketProcessor extends WorkerHost {
  private logger = new GenericOperationLogger('EthWebsocketProcessor')
  constructor(private readonly balanceService: BalanceService) {
    super()
  }

  @LogOperation('processor_job_start', GenericOperationLogger)
  async process(
    @LogContext job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    // Business event logging for job start
    this.logger.logProcessorJobStart(
      'EthWebsocketProcessor',
      job.id || 'unknown',
      job.data?.intentHash || 'unknown',
    )

    switch (job.name) {
      case QUEUES.ETH_SOCKET.jobs.erc20_balance_socket:
        // Log websocket event processing
        this.logger.debug(
          { operationType: 'websocket_event', status: 'processing' },
          `EthWebsocketProcessor: ws event`,
          { event: job.data },
        )
        return this.balanceService.updateBalance(job.data as ViemEventLog)
      default:
        this.logger.error(
          { operationType: 'processor_error', status: 'failed' },
          `EthWebsocketProcessor: Invalid job type ${job.name}`,
          undefined,
          { jobName: job.name, jobId: job.id },
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  @LogOperation('processor_job_failed', GenericOperationLogger)
  onFailed(@LogContext job: Job<any, any, string>, error: Error) {
    // Business event logging for job failure
    this.logger.logProcessorJobFailed('EthWebsocketProcessor', job.id || 'unknown', error)
  }

  @OnWorkerEvent('stalled')
  @LogOperation('processor_stalled', GenericOperationLogger)
  onStalled(@LogContext jobId: string, prev?: string) {
    this.logger.warn(
      { operationType: 'processor_stalled', status: 'warning' },
      `EthWebsocketProcessor: Job stalled`,
      { jobId, prev },
    )
  }

  @OnWorkerEvent('error')
  @LogOperation('processor_error', GenericOperationLogger)
  onWorkerError(error: Error) {
    this.logger.error(
      { operationType: 'processor_error', status: 'error' },
      `EthWebsocketProcessor: Worker error`,
      error,
      { errorName: error.name, errorMessage: error.message },
    )
  }
}
