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
import { Hex } from 'viem'
import { EcoError } from '../common/errors/eco-error'
import { ValidationChecks, ValidationService, validationsFailed } from '@/intent/validation.sevice'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'

/**
 * Type that merges the {@link ValidationChecks} with the intentFunded check
 */
export type IntentValidations = ValidationChecks & {
  intentFunded: boolean
}

/**
 * Service class that acts as the main validation service for intents.
 * Validation {@license ValidationService}:
 * 1. Supports the prover
 * 2. Supports the targets
 * 3. Supports the selectors
 * 4. Has a valid transfer limit
 * 5. Has a valid expiration time
 * 6. Fulfill chain not same as source chain
 *
 * Validates that the intent was also funded:
 * 1. The intent was funded on chain in the IntentSource
 *
 * As well as some structural checks on the intent model
 */
@Injectable()
export class ValidateIntentService implements OnModuleInit {
  private logger = new Logger(ValidateIntentService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly validationService: ValidationService,
    private readonly multichainPublicClientService: MultichainPublicClientService,
    private readonly utilsIntentService: UtilsIntentService,
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

    if (await this.assertValidations(model, solver)) {
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

      if (model.chain === 'SVM') {
        await this.intentQueue.add(QUEUES.SOLANA_INTENT.jobs.feasable_intent, intentHash, {
          jobId,
          ...this.intentJobConfig,
        })
      } else {
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.feasable_intent, intentHash, {
          jobId,
          ...this.intentJobConfig,
        })
      }
    } else {
      return false
    }

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
    const validations = (await this.validationService.assertValidations(
      model.intent,
      solver,
    )) as IntentValidations
    validations.intentFunded = await this.intentFunded(model)

    if (validationsFailed(validations)) {
      await this.utilsIntentService.updateInvalidIntentModel(model, validations)
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: EcoError.IntentValidationFailed(model.intent.hash).message,
          properties: {
            model,
            validations,
          },
        }),
      )
      return false
    }

    return true
  }

  /**
   * Makes on onchain read call to make sure that the intent was funded in the IntentSource
   * contract.
   * @Notice An event emitted is not enough to guarantee that the intent was funded
   * @param model the source intent model
   * @returns
   */
  async intentFunded(model: IntentSourceModel): Promise<boolean> {
    const sourceChainID = Number(model.intent.route.source)
    const client = await this.multichainPublicClientService.getClient(sourceChainID)
    const intentSource = this.ecoConfigService.getIntentSource(sourceChainID)
    if (!intentSource) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: EcoError.IntentSourceNotFound(sourceChainID).message,
          properties: {
            model,
          },
        }),
      )
      return false
    }

    const isIntentFunded = await client.readContract({
      address: intentSource.sourceAddress,
      abi: IntentSourceAbi,
      functionName: 'isIntentFunded',
      args: [IntentDataModel.toChainIntent(model.intent)],
    })
    return isIntentFunded
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
}
