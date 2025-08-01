import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hex } from 'viem'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentSourceAbi, IntentType, hashIntent } from '@eco-foundation/routes-ts'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IntentProcessData, UtilsIntentService } from './utils-intent.service'
import { delay } from '@/common/utils/time'
import { QUEUES } from '@/common/redis/constants'
import { EcoError } from '@/common/errors/eco-error'
import { getIntentJobId } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import {
  ValidationChecks,
  ValidationFlags,
  ValidationService,
  validationsFailed,
} from '@/intent/validation.sevice'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS, ERROR_EVENTS } from '@/analytics/events.constants'

/**
 * Type that merges the {@link ValidationChecks} with the intentFunded check
 */
export type IntentValidations = ValidationChecks & {
  intentFunded: boolean
}

export interface AssertValidationsFlags extends ValidationFlags {
  skipIntentFunded?: boolean
}

/**
 * Parameters for the assertValidations method
 */
export interface AssertValidationsParams {
  intent: IntentType
  solver: Solver
  intentSourceModel?: IntentSourceModel
  flags?: AssertValidationsFlags
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
   * Validates a full intent given the IntentType parameter
   * @param intent the intent data to validate
   * @param flags
   * @returns true if the intent is valid, false otherwise
   */
  async validateFullIntent(intent: IntentType, flags?: AssertValidationsFlags): Promise<boolean> {
    const sourceChainId = Number(intent.route.source)
    const solver = this.ecoConfigService.getSolver(sourceChainId)

    if (!solver) {
      const intentHash = 'hash' in intent ? (intent as any).hash : hashIntent(intent)
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `No solver found for source chain ${sourceChainId}`,
          properties: {
            intentHash,
            sourceChainId,
          },
        }),
      )
      this.ecoAnalytics.trackIntentValidationFailed(
        intentHash,
        'no_solver_found',
        'validateFullIntent',
      )
      return false
    }

    return this.assertValidations({ intent, solver, flags })
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

    if (
      !(await this.assertValidations({ intent: model.intent, solver, intentSourceModel: model }))
    ) {
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
   * Executes all the validations we have on the intent and solver
   *
   * @param params the validation parameters
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(params: AssertValidationsParams): Promise<boolean> {
    const { intent, solver, intentSourceModel, flags } = params

    const validations = (await this.validationService.assertValidations(
      intent as any,
      solver,
      undefined, // txValidationFn - use default
      flags,
    )) as IntentValidations

    // Only check intent funded if not skipped
    if (!flags?.skipIntentFunded) {
      validations.intentFunded = await this.intentFunded(intent)
    } else {
      validations.intentFunded = true // Default to true when skipped
    }

    if (validationsFailed(validations)) {
      const intentHash = 'hash' in intent ? (intent as any).hash : hashIntent(intent)
      if (intentSourceModel) {
        await this.utilsIntentService.updateInvalidIntentModel(intentSourceModel, validations)
      }
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: EcoError.IntentValidationFailed(intentHash).message,
          properties: {
            intent,
            validations,
          },
        }),
      )

      // Track validation failure with detailed reasons
      this.ecoAnalytics.trackIntentValidationFailed(
        intentHash,
        'validation_checks_failed',
        'assertValidations',
        {
          intent,
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
    const intentHash = 'hash' in intent ? (intent as any).hash : hashIntent(intent)
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.VALIDATION_CHECKS_PASSED, {
      intentHash,
      intent,
      solver,
      validationResults: validations,
    })

    return true
  }

  /**
   * Makes on onchain read call to make sure that the intent was funded in the IntentSource
   * contract.
   * @Notice An event emitted is not enough to guarantee that the intent was funded
   * @param intent the intent data
   * @returns
   */
  async intentFunded(intent: IntentType): Promise<boolean> {
    const sourceChainID = Number(intent.route.source)
    const client = await this.multichainPublicClientService.getClient(sourceChainID)
    const intentSource = this.ecoConfigService.getIntentSource(sourceChainID)
    if (!intentSource) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: EcoError.IntentSourceNotFound(sourceChainID).message,
          properties: {
            intent,
          },
        }),
      )

      // Track intent source not found error
      const intentHash = 'hash' in intent ? (intent as any).hash : hashIntent(intent)
      this.ecoAnalytics.trackError(
        ERROR_EVENTS.INTENT_FUNDING_CHECK_FAILED,
        EcoError.IntentSourceNotFound(sourceChainID),
        {
          intentHash,
          reason: 'intent_source_not_found',
          sourceChainID,
        },
      )
      return false
    }

    let retryCount = 0
    let isIntentFunded = false

    // Track funding check start
    const intentHash = 'hash' in intent ? (intent as any).hash : hashIntent(intent)
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_STARTED, {
      intentHash,
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
              intentHash,
            },
          }),
        )

        // Track retry attempt
        this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_RETRY, {
          intentHash,
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
        args: [intent],
      })

      retryCount++
    } while (!isIntentFunded && retryCount <= this.MAX_RETRIES)

    // Track funding check result
    if (isIntentFunded) {
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FUNDING_VERIFIED, {
        intentHash,
        sourceChainID,
        retryCount: retryCount - 1,
        funded: true,
      })
    } else {
      this.ecoAnalytics.trackError(
        ANALYTICS_EVENTS.INTENT.FUNDING_CHECK_FAILED,
        new Error('intent_not_funded_after_retries'),
        {
          intentHash,
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
