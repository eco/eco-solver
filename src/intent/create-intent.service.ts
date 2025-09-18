import {
  CallDataInterface,
  decodeCreateIntentLog,
  IntentCreatedLog,
  RewardTokensInterface,
} from '../contracts'
import { deserialize, Serialize } from '@/common/utils/serialize'
import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoResponse } from '@/common/eco-response'
import { FlagService } from '../flags/flags.service'
import { getIntentJobId } from '../common/utils/strings'
import { Hex } from 'viem'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentDataModel } from './schemas/intent-data.schema'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { JobsOptions, Queue } from 'bullmq'
import { QUEUES } from '../common/redis/constants'
import { ValidSmartWalletService } from '../solver/filters/valid-smart-wallet.service'
import { IntentOperationLogger } from '@/common/logging'
import { hashIntent, RouteType } from '@eco-foundation/routes-ts'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'

/**
 * This service is responsible for creating a new intent record in the database. It is
 * triggered when a new intent is created recieved in {@link WatchIntentService}.
 * It validates that the record doesn't exist yet, and that its creator is a valid BEND wallet
 */
@Injectable()
export class CreateIntentService implements OnModuleInit {
  private logger = new IntentOperationLogger('CreateIntentService')
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly intentSourceRepository: IntentSourceRepository,
    private readonly validSmartWalletService: ValidSmartWalletService,
    private readonly flagService: FlagService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }

  /**
   * Decodes the intent log, validates the creator is a valid BEND wallet, and creates a new record in the database
   * if one doesn't yet exist. Finally it enqueue the intent for validation
   *
   * @param serializedIntentWs the serialized intent created log
   * @returns
   */
  @LogOperation('intent_creation', IntentOperationLogger)
  async createIntent(@LogContext serializedIntentWs: Serialize<IntentCreatedLog>) {
    const intentWs = deserialize(serializedIntentWs)

    const ei = decodeCreateIntentLog(intentWs.data, intentWs.topics)
    const intent = IntentDataModel.fromEvent(ei, intentWs.logIndex || 0)

    try {
      // Check db if the intent is already filled
      const model = await this.intentSourceRepository.getIntent(intent.hash)

      if (model) {
        // Log business event for duplicate detection
        this.logger.logDuplicateIntentDetected(model, intent, intentWs)
        this.ecoAnalytics.trackIntentDuplicateDetected(intent, model, intentWs)
        return
      }

      const validWallet = this.flagService.getFlagValue('bendWalletOnly')
        ? await this.validSmartWalletService.validateSmartWallet(
            intent.reward.creator as Hex,
            intentWs.sourceChainID,
          )
        : true

      // Create db record
      await this.intentSourceRepository.create({
        event: intentWs,
        intent: intent,
        receipt: null,
        status: validWallet ? 'PENDING' : 'NON-BEND-WALLET',
      })

      const jobId = getIntentJobId('create', intent.hash as Hex, intent.logIndex)
      if (validWallet) {
        //add to processing queue
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, intent.hash, {
          jobId,
          ...this.intentJobConfig,
        })

        // Track successful intent creation and queue addition
        this.ecoAnalytics.trackIntentCreatedAndQueued(intent, jobId, intentWs)
      } else {
        // Track intent created but not queued due to invalid wallet
        this.ecoAnalytics.trackIntentCreatedWalletRejected(intent, intentWs)
      }
    } catch (e) {
      // Log business event for creation failure
      this.logger.logIntentCreationFailure(intent, e as Error, intentWs)
      this.ecoAnalytics.trackIntentCreationFailed(intent, intentWs, e)
    }
  }

  @LogOperation('gasless_intent_creation', IntentOperationLogger)
  async createIntentFromIntentInitiation(
    @LogContext quoteID: string,
    @LogContext funder: Hex,
    @LogContext route: RouteType,
    @LogContext reward: QuoteRewardDataModel,
  ) {
    try {
      const { salt, source, destination, inbox, tokens: routeTokens, calls } = route
      const { creator, prover, deadline, nativeValue, tokens: rewardTokens } = reward
      const intentHash = hashIntent({ route, reward }).intentHash

      // Track gasless intent creation attempt with complete objects
      this.ecoAnalytics.trackGaslessIntentCreationStarted(
        intentHash,
        quoteID,
        funder,
        route,
        reward,
      )

      const intent = new IntentDataModel({
        quoteID,
        hash: intentHash,
        salt,
        source,
        destination,
        inbox,
        routeTokens: routeTokens as RewardTokensInterface[],
        calls: calls as CallDataInterface[],
        creator,
        prover,
        deadline,
        nativeValue,
        rewardTokens,
        logIndex: 0,
        funder,
      })

      await this.intentSourceRepository.create({
        // event: null,
        intent,
        receipt: null,
        status: 'PENDING',
      })

      // Track successful gasless intent creation with complete context
      this.ecoAnalytics.trackGaslessIntentCreated(
        intentHash,
        quoteID,
        funder,
        intent,
        route,
        reward,
      )
    } catch (ex) {
      // Log business event for gasless creation failure
      this.logger.logGaslessIntentCreationFailure(quoteID, funder, route, reward, ex as Error)
      this.ecoAnalytics.trackIntentCreationFailed({ quoteID, route, reward }, null, ex)
    }
  }

  /**
   * Fetch an intent from the db
   * @param hash for fetching the intent
   * @returns the intent or an error
   */
  @LogOperation('intent_hash_lookup', IntentOperationLogger)
  async getIntentForHash(@LogContext hash: string): Promise<EcoResponse<IntentSourceModel>> {
    try {
      const result = await this.fetchIntent({ 'intent.hash': hash })

      if (result.error) {
        this.ecoAnalytics.trackIntentRetrievalNotFound('getIntentForHash', { hash }, result.error)
      } else {
        this.ecoAnalytics.trackIntentRetrievalSuccess('getIntentForHash', {
          hash,
          intent: result.response,
        })
      }

      return result
    } catch (error) {
      this.ecoAnalytics.trackIntentRetrievalError('getIntentForHash', error, { hash })
      throw error
    }
  }

  /**
   * Fetch an intent from the db
   * @param query for fetching the intent
   * @returns the intent or an error
   */
  @LogOperation('intent_fetch', IntentOperationLogger)
  async fetchIntent(@LogContext query: object): Promise<EcoResponse<IntentSourceModel>> {
    try {
      const intent = await this.intentSourceRepository.queryIntent(query)

      if (!intent) {
        const error = EcoError.IntentNotFound
        this.ecoAnalytics.trackIntentRetrievalNotFound('fetchIntent', { query }, error)
        return { error }
      }

      this.ecoAnalytics.trackIntentRetrievalSuccess('fetchIntent', { query, intent })
      return { response: intent }
    } catch (error) {
      this.ecoAnalytics.trackIntentRetrievalError('fetchIntent', error, { query })
      throw error
    }
  }
}
