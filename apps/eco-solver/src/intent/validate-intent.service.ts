import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hex } from 'viem'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { Solver } from '@libs/eco-solver-config'
import { EcoConfigService } from '@libs/eco-solver-config'
import { IntentProcessData, UtilsIntentService } from './utils-intent.service'
import { delay } from '@eco-solver/common/utils/time'
import { QUEUES } from '@eco-solver/common/redis/constants'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { getIntentJobId } from '@eco-solver/common/utils/strings'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service'
import { IntentDataModel } from '@eco-solver/intent/schemas/intent-data.schema'
import {
  ValidationChecks,
  ValidationService,
  validationsFailed,
} from '@eco-solver/intent/validation.sevice'
import { EcoAnalyticsService } from '@eco-solver/analytics'
import { ANALYTICS_EVENTS, ERROR_EVENTS } from '@eco-solver/analytics/events.constants'

/**
 * Type that merges the {@link ValidationChecks} with the intentFunded check
 */
export type IntentValidations = ValidationChecks & {
  intentFunded: boolean
}

/**
 * Service class that acts as the main validation service for intents.
 * Validation {@license ValidationService}:
 * supportedProver: boolean
 * supportedNative: boolean
 * supportedTargets: boolean
 * supportedTransaction: boolean
 * validTransferLimit: boolean
 * validExpirationTime: boolean
 * validDestination: boolean
 * fulfillOnDifferentChain: boolean
 * sufficientBalance: boolean
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
  private MAX_RETRIES: number
  private RETRY_DELAY_MS: number

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly validationService: ValidationService,
    private readonly multichainPublicClientService: MultichainPublicClientService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
    const intentConfigs = this.ecoConfigService.getIntentConfigs()
    this.MAX_RETRIES = intentConfigs.intentFundedRetries
    this.RETRY_DELAY_MS = intentConfigs.intentFundedRetryDelayMs
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

    // Track validation start
    this.ecoAnalytics.trackIntentValidationStarted(intentHash)

    const { model, solver } = await this.destructureIntent(intentHash)
    if (!model || !solver) {
      // Track validation failed due to missing data
      this.ecoAnalytics.trackIntentValidationFailed(
        intentHash,
        'missing_model_or_solver',
        'destructure',
      )
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

    // Track successful validation and queue addition
    this.ecoAnalytics.trackIntentValidatedAndQueued(intentHash, jobId, model)

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

      // Track validation failure with detailed reasons
      this.ecoAnalytics.trackIntentValidationFailed(
        model.intent.hash,
        'validation_checks_failed',
        'assertValidations',
        {
          model,
          solver,
          validationResults: validations,
          failedChecks: Object.entries(validations)
            .filter(([, passed]) => !passed)
            .map(([check]) => check),
        },
      )
      return false
    }

    // Track successful validation
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.VALIDATION_CHECKS_PASSED, {
      intentHash: model.intent.hash,
      model,
      solver,
      validationResults: validations,
    })

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

      // Track intent source not found error
      this.ecoAnalytics.trackError(
        ERROR_EVENTS.INTENT_FUNDING_CHECK_FAILED,
        EcoError.IntentSourceNotFound(sourceChainID),
        {
          intentHash: model.intent.hash,
          reason: 'intent_source_not_found',
          sourceChainID,
        },
      )
      return false
    }

    let retryCount = 0
    let isIntentFunded = false

    // Track funding check start
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_STARTED, {
      intentHash: model.intent.hash,
      sourceChainID,
      maxRetries: this.MAX_RETRIES,
      retryDelayMs: this.RETRY_DELAY_MS,
    })

    do {
      // Add delay for retries (skip delay on first attempt)
      if (retryCount > 0) {
        await delay(this.RETRY_DELAY_MS, retryCount - 1)

        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `intentFunded check failed, retrying... (${retryCount}/${this.MAX_RETRIES})`,
            properties: {
              intentHash: model.intent.hash,
            },
          }),
        )

        // Track retry attempt
        this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_RETRY, {
          intentHash: model.intent.hash,
          retryCount,
          maxRetries: this.MAX_RETRIES,
          sourceChainID,
        })
      }

      // Check if the intent is funded
      isIntentFunded = await client.readContract({
        address: intentSource.sourceAddress,
        abi: IntentSourceAbi,
        functionName: 'isIntentFunded',
        args: [IntentDataModel.toChainIntent(model.intent)],
      })

      retryCount++
    } while (!isIntentFunded && retryCount <= this.MAX_RETRIES)

    // Track funding check result
    if (isIntentFunded) {
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_VERIFIED, {
        intentHash: model.intent.hash,
        sourceChainID,
        retryCount: retryCount - 1,
        funded: true,
      })
    } else {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_FAILED,
        new Error('intent_not_funded_after_retries'),
        {
          intentHash: model.intent.hash,
          sourceChainID,
          retryCount: retryCount - 1,
          maxRetries: this.MAX_RETRIES,
          reason: 'intent_not_funded_after_retries',
          funded: false,
        },
      )
    }

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
