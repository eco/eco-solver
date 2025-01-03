import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { IntentProcessData, UtilsIntentService } from './utils-intent.service'
import { QUEUES } from '../common/redis/constants'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { getIntentJobId } from '../common/utils/strings'
import { Solver } from '../eco-configs/eco-config.types'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { ProofService } from '../prover/proof.service'
import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { EcoError } from '../common/errors/eco-error'

/**
 * Service class that acts as the main validation service for intents. It validates that
 * the solver:
 * 1. Supports the prover
 * 2. Supports the targets
 * 3. Supports the selectors
 * 4. Has a valid expiration time
 *
 * As well as some structural checks on the intent model
 */
@Injectable()
export class ValidateIntentService implements OnModuleInit {
  private logger = new Logger(ValidateIntentService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly proofService: ProofService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }

  /**
   * @param intentHash the hash of the intent to fulfill
   */
  async validateIntent(intentHash: Hex) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `validateIntent ${intentHash}`,
        properties: {
          intentHash: intentHash,
        },
      }),
    )

    const { model, solver } = await this.destructureIntent(intentHash)
    if (!model || !solver) {
      return false
    }

    if (!(await this.assertValidations(model, solver))) {
      return false
    }

    const jobId = getIntentJobId('validate', intentHash, model.intent.logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `validateIntent ${intentHash}`,
        properties: {
          intentHash,
          jobId,
        },
      }),
    )
    //add to processing queue
    await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.feasable_intent, intentHash, {
      jobId,
      ...this.intentJobConfig,
    })

    return true
  }

  /**
   * Executes all the validations we have on the model and solver
   *
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(model: IntentSourceModel, solver: Solver): Promise<boolean> {
    if (!this.isRewardsEqualSized(model)) {
      return false
    }

    const proverUnsupported = !this.supportedProver(model)
    const targetsUnsupported = !this.supportedTargets(model, solver)
    const selectorsUnsupported = !this.supportedSelectors(model, solver)
    const expiresEarly = !this.validExpirationTime(model)

    if (proverUnsupported || targetsUnsupported || selectorsUnsupported || expiresEarly) {
      await this.utilsIntentService.updateInvalidIntentModel(model, {
        proverUnsupported,
        targetsUnsupported,
        selectorsUnsupported,
        expiresEarly,
      })
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Intent failed validation ${model.intent.hash}`,
          properties: {
            model,
            proverUnsupported,
            targetsUnsupported,
            selectorsUnsupported,
            expiresEarly,
            ...(expiresEarly && {
              proofMinDurationSeconds: this.proofService
                .getProofMinimumDate(this.proofService.getProverType(model.intent.prover))
                .toUTCString(),
            }),
          },
        }),
      )
      return false
    }

    return true
  }

  /**
   * Fetches the intent from the db and its solver and model from configs. Validates
   * that both are returned without any error
   *
   * @param intentHash the hash of the intent to find in the db
   * @returns
   */
  private async destructureIntent(intentHash: Hex): Promise<IntentProcessData> {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}
    if (!data || !model || !solver) {
      throw EcoError.ValidateIntentDescructureFailed(err)
    }
    return data
  }

  /**
   * Checks if the IntentCreated event is using a supported prover. It first finds the source intent contract that is on the
   * source chain of the event. Then it checks if the prover is supported by the source intent. In the
   * case that there are multiple matching source intent contracts on the same chain, as long as any of
   * them support the prover, the function will return true.
   *
   * @param model the source intent model
   * @returns
   */
  private supportedProver(model: IntentSourceModel): boolean {
    const srcSolvers = this.ecoConfigService.getIntentSources().filter((intent) => {
      return BigInt(intent.chainID) == model.event.sourceChainID
    })

    return srcSolvers.some((intent) => {
      return intent.provers.some((prover) => prover == model.intent.prover)
    })
  }

  /**
   * Checks if the target in the event is supported on its solver
   *
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  private supportedTargets(model: IntentSourceModel, solver: Solver): boolean {
    return !!this.utilsIntentService.targetsSupported(model, solver)
  }

  /**
   * Checks if the selectors in the event are supported on the solver
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  private supportedSelectors(model: IntentSourceModel, solver: Solver): boolean {
    //check if the targets support the selectors encoded in the intent data
    return !!this.utilsIntentService.selectorsSupported(model, solver)
  }

  /**
   *
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  private validExpirationTime(model: IntentSourceModel): boolean {
    //convert to milliseconds
    const time = Number.parseInt(`${model.intent.expiryTime as bigint}`) * 1000
    const expires = new Date(time)
    return !!this.proofService.isIntentExpirationWithinProofMinimumDate(
      model.intent.prover,
      expires,
    )
  }

  /**
   * Checks if the rewards and amounts arrays are of equal size
   * @param model the source intent model
   * @returns
   */
  isRewardsEqualSized(model: IntentSourceModel) {
    //check that the rewards and amounts are equal sized
    if (model.intent.rewardTokens.length !== model.intent.rewardAmounts.length) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateIntent: Rewards mismatch`,
          properties: {
            intent: model.intent,
          },
        }),
      )
      return false
    }
    return true
  }
}
