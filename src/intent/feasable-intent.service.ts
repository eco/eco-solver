import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { getIntentJobId } from '@/common/utils/strings'
import { Hex } from 'viem'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { FeeService } from '@/fee/fee.service'

/**
 * Service responsible for validating intent feasibility and managing the intent processing pipeline.
 * Determines if an intent can be profitably executed by the solver and queues feasible intents for fulfillment.
 */
@Injectable()
export class FeasableIntentService implements OnModuleInit {
  private logger = new Logger(FeasableIntentService.name)
  private intentJobConfig: JobsOptions
  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  async onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }
  async feasableQuote(quoteIntent: QuoteIntentModel) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `feasableQuote intent ${quoteIntent._id}`,
      }),
    )
  }
  /**
   * Validates that the execution of the intent is feasible. This means that the solver can execute
   * the transaction and that transaction cost is profitable to the solver.
   * @param intentHash the intent hash to fetch the intent data from the db with
   * @returns
   */
  async feasableIntent(intentHash: Hex) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
      }),
    )
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}
    if (!model || !solver) {
      if (err) {
        throw err
      }
      return
    }

    const { error } = await this.feeService.isRouteFeasible(model.intent)

    const jobId = getIntentJobId('feasable', intentHash, model!.intent.logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
        properties: {
          feasable: !error,
          ...(!error ? { jobId } : {}),
        },
      }),
    )
    if (!error) {
      //add to processing queue
      await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.fulfill_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(model, error)
    }
  }
}
