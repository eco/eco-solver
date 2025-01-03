import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { QUEUES } from '@/common/redis/constants'
import { getIntentJobId } from '@/common/utils/strings'
import { Proofs } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { ProofService } from '@/prover/proof.service'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { JobsOptions, Queue } from 'bullmq'
import { Model } from 'mongoose'

@Injectable()
export class RetryInfeasableIntentsService implements OnApplicationBootstrap {
  private logger = new Logger(RetryInfeasableIntentsService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.INTERVAL.queue) private readonly intervalQueue: Queue,
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly proofService: ProofService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getIntervals().retryInfeasableIntents.jobTemplate
      .opts as JobsOptions
  }

  async onApplicationBootstrap() {
    const config = this.ecoConfigService.getIntervals().retryInfeasableIntents
    config.repeatOpts = { ...config.repeatOpts, immediately: true }
    config.jobTemplate = {
      ...config.jobTemplate,
      name: QUEUES.INTERVAL.jobs.retry_infeasable_intents,
    }
    this.intervalQueue.upsertJobScheduler(
      QUEUES.INTERVAL.jobs.RETRY_INFEASABLE_INTENTS,
      config.repeatOpts,
      config.jobTemplate,
    )
  }

  /**
   * Retries intents that are infeasable but still within the proof expiration window.
   * Sends them on the {@link QUEUES.SOURCE_INTENT.jobs.retry_intent} queue to validate
   */
  async retryInfeasableIntents() {
    const models = await this.getInfeasableIntents()
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `retryInfeasableIntents`,
        properties: {
          models,
        },
      }),
    )

    const retryTasks = models.map(async (model) => {
      const jobId = getIntentJobId('retry', model.intent.hash, model.intent.logIndex)

      //add to processing queue
      await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.retry_intent, model.intent.hash, {
        jobId,
        ...this.intentJobConfig,
      })
    })

    await Promise.all(retryTasks)
  }

  private async getInfeasableIntents() {
    return await this.intentModel.find({
      status: 'INFEASABLE',
      $or: [
        {
          'intent.expiration': { $gt: this.proofService.getProofMinimumDate(Proofs.Hyperlane) },
          'intent.prover': { $in: this.proofService.getProvers(Proofs.Hyperlane) },
        },
        {
          'intent.expiration': { $gt: this.proofService.getProofMinimumDate(Proofs.Storage) },
          'intent.prover': { $in: this.proofService.getProvers(Proofs.Storage) },
        },
      ],
    })
  }
}
