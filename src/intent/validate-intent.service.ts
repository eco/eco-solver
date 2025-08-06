import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Address as EvmAddress, Hex } from 'viem'
import { PublicKey, Connection } from '@solana/web3.js'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { checkIntentFunding, SolanaReward } from './check-funded-solana'
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
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { ValidationChecks, ValidationService, validationsFailed } from '@/intent/validation.sevice'

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

    let retryCount = 0
    let isIntentFunded = false

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
      }

      // Check if the intent is funded
      if (model.intent.route.source === 1399811150n || model.intent.route.destination === 1399811150n) {
        console.log("JUSTLOGGING: intentFunded called for solana", model.intent.route)
        // Solana intent funding check
        try {
          const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
          
          // Convert intent model to SolanaReward format
          const solanaReward: SolanaReward = {
            deadline: Number(model.intent.reward.deadline),
            creator: model.intent.reward.creator.toString(),
            prover: model.intent.reward.prover.toString(),
            native_amount: Number(model.intent.reward.nativeAmount),
            tokens: model.intent.reward.tokens.map(token => ({
              token: token.token.toString(),
              amount: Number(token.amount)
            }))
          };

          // Get route hash from intent
          const routeHash = new Uint8Array(Buffer.from(model.intent.route.hash.replace('0x', ''), 'hex'));
          
          isIntentFunded = await checkIntentFunding(
            connection,
            Number(model.intent.route.destination),
            routeHash,
            solanaReward
          );
        } catch (error) {
          this.logger.error(`Error checking Solana intent funding: ${error}`);
          isIntentFunded = false;
        }
      } else {
        isIntentFunded = await client.readContract({
          address: intentSource.sourceAddress as `0x${string}`,
          abi: IntentSourceAbi,
          functionName: 'isIntentFunded',
          args: [IntentDataModel.toChainIntent(model.intent) as any], // TODO: fix this
        })
      }

      

      retryCount++
    } while (!isIntentFunded && retryCount <= this.MAX_RETRIES)

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
