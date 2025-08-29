import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { BalanceService } from '../../balance/balance.service'
import { ViemEventLog } from '../../common/events/viem'

@Injectable()
@Processor(QUEUES.ETH_SOCKET.queue)
export class EthWebsocketProcessor extends WorkerHost {
  private logger = new Logger(EthWebsocketProcessor.name)
  constructor(private readonly balanceService: BalanceService) {
    super()
  }

  async process(
    job: Job<any, any, string>,
    processToken?: string | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<any> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `EthWebsocketProcessor: process`,
      }),
    )

    switch (job.name) {
      case QUEUES.ETH_SOCKET.jobs.erc20_balance_socket:
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `EthWebsocketProcessor: ws event`,
            properties: {
              event: job.data,
            },
          }),
        )
        return this.balanceService.updateBalance(job.data as ViemEventLog)
      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `EthWebsocketProcessor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<any, any, string>, error: Error) {
    this.logger.error(
      EcoLogMessage.withError({
        message: `EthWebsocketProcessor: Error processing job`,
        error,
        properties: { job },
      }),
    )
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string, prev?: string) {
    this.logger.warn(
      EcoLogMessage.fromDefault({
        message: `EthWebsocketProcessor: Job stalled`,
        properties: {
          jobId,
          prev,
        },
      }),
    )
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    this.logger.error(
      EcoLogMessage.withError({
        message: `EthWebsocketProcessor: Worker error`,
        error,
      }),
    )
  }
}
