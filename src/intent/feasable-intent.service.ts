import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { QUEUES } from '../common/redis/constants'
import { UtilsIntentService } from './utils-intent.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { getIntentJobId } from '../common/utils/strings'
import { Hex } from 'viem'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { FeasibilityService } from '@/intent/feasibility.service'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasableIntentService implements OnModuleInit {
  private logger = new Logger(FeasableIntentService.name)
  private intentJobConfig: JobsOptions
  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly feasibilityService: FeasibilityService,
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

    //check if we have tokens on the solver chain
    const { feasable, results } = await this.feasibilityService.validateExecution(model.intent, solver)
    const jobId = getIntentJobId('feasable', intentHash, model!.intent.logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
        properties: {
          feasable,
          ...(feasable ? { jobId } : {}),
        },
      }),
    )
    if (feasable) {
      //add to processing queue
      await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.fulfill_intent, intentHash, {
        jobId,
        ...this.intentJobConfig,
      })
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(model, results)
    }
  }
}
