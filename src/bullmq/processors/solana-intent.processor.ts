import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { Hex } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { SolanaValidateIntentService } from '@/intent/solana-validate-intent.service'
import { SolanaFeasableIntentService } from '@/intent/solana-feasable-intent.service'
import { SolanaFulfillService } from '@/intent/solana-fulfill-intent.service'

@Injectable()
@Processor(QUEUES.SOLANA_INTENT.queue, { concurrency: 150 })
export class SolanaIntentProcessor extends WorkerHost {
  private readonly logger = new Logger(SolanaIntentProcessor.name)

  constructor(
    private readonly validateIntentService: SolanaValidateIntentService,
    private readonly feasableIntentService: SolanaFeasableIntentService,
    private readonly fulfillIntentService: SolanaFulfillService,
  ) {
    super()
  }

  async process(job: Job) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `SVM Processor: process`,
      }),
    )

    switch (job.name) {
      case QUEUES.SOLANA_INTENT.jobs.validate_intent:
      case QUEUES.SOLANA_INTENT.jobs.retry_intent:
        return this.validateIntentService.validateIntent(job.data as Hex)

      case QUEUES.SOLANA_INTENT.jobs.feasable_intent:
        return this.feasableIntentService.feasableIntent(job.data as Hex)

      case QUEUES.SOLANA_INTENT.jobs.fulfill_intent:
        return this.fulfillIntentService.fulfill(job.data as Hex)

      default:
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `SVM Processor: Invalid job type ${job.name}`,
          }),
        )
        return Promise.reject('Invalid job type')
    }
  }
}
