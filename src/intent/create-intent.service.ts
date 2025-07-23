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
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { FlagService } from '../flags/flags.service'
import { getIntentJobId } from '../common/utils/strings'
import { hashIntent, RouteType } from '@eco-foundation/routes-ts'
import { Hex } from 'viem'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentDataModel } from './schemas/intent-data.schema'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { JobsOptions, Queue } from 'bullmq'
import { Model } from 'mongoose'
import { ModuleRef } from '@nestjs/core'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { QUEUES } from '../common/redis/constants'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { ValidSmartWalletService } from '../solver/filters/valid-smart-wallet.service'

/**
 * This service is responsible for creating a new intent record in the database. It is
 * triggered when a new intent is created recieved in {@link WatchIntentService}.
 * It validates that the record doesn't exist yet, and that its creator is a valid BEND wallet
 */
@Injectable()
export class CreateIntentService implements OnModuleInit {
  private logger = new EcoLogger(CreateIntentService.name)
  private intentJobConfig: JobsOptions
  private negativeIntentAnalyzerService: NegativeIntentAnalyzerService

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly validSmartWalletService: ValidSmartWalletService,
    private readonly flagService: FlagService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
    this.negativeIntentAnalyzerService = this.moduleRef.get(NegativeIntentAnalyzerService, {
      strict: false,
    })
  }

  /**
   * Decodes the intent log, validates the creator is a valid BEND wallet, and creates a new record in the database
   * if one doesn't yet exist. Finally it enqueue the intent for validation
   *
   * @param serializedIntentWs the serialized intent created log
   * @returns
   */
  async createIntent(serializedIntentWs: Serialize<IntentCreatedLog>) {
    const intentWs = deserialize(serializedIntentWs)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `createIntent ${intentWs.transactionHash}`,
        properties: {
          transactionHash: intentWs.transactionHash,
          intentHash: intentWs.args?.hash,
        },
      }),
    )

    const ei = decodeCreateIntentLog(intentWs.data, intentWs.topics)
    const intent = IntentDataModel.fromEvent(ei, intentWs.logIndex || 0)

    try {
      //check db if the intent is already filled
      const model = await this.intentModel.findOne({
        'intent.hash': intent.hash,
      })

      if (model) {
        // Record already exists, do nothing and return
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `Record for intent already exists ${intent.hash}`,
            properties: {
              intentHash: intent.hash,
              intent: intent,
            },
          }),
        )

        // Track duplicate intent detection
        this.ecoAnalytics.trackIntentDuplicateDetected(intent, model, intentWs)
        return
      }

      const validWallet = this.flagService.getFlagValue('bendWalletOnly')
        ? await this.validSmartWalletService.validateSmartWallet(
            intent.reward.creator as Hex,
            intentWs.sourceChainID,
          )
        : true

      //create db record
      const record = await this.intentModel.create({
        event: intentWs,
        intent: intent,
        receipt: null,
        status: validWallet ? 'PENDING' : 'NON-BEND-WALLET',
      })

      const jobId = getIntentJobId('create', intent.hash as Hex, intent.logIndex)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Recorded intent ${record.intent.hash}`,
          properties: {
            intentHash: intent.hash,
            intent: record.intent,
            validWallet,
            ...(validWallet ? { jobId } : {}),
          },
        }),
      )

      if (!validWallet) {
        // Track intent created but not queued due to invalid wallet
        this.ecoAnalytics.trackIntentCreatedWalletRejected(intent, intentWs)
        return
      }

      const isNegativeIntent = this.negativeIntentAnalyzerService.isNegativeIntent(record)

      if (isNegativeIntent) {
        // Track intent created but not queued due to being a negative intent
        this.ecoAnalytics.trackIntentCreatedNegativeIntentRejected(intent, intentWs)
        return
      }

      // Add to processing queue
      await this.intentQueue.add(
        QUEUES.SOURCE_INTENT.jobs.validate_intent,
        { intentHash: intent.hash },
        {
          jobId,
          ...this.intentJobConfig,
        },
      )

      // Track successful intent creation and queue addition
      this.ecoAnalytics.trackIntentCreatedAndQueued(intent, jobId, intentWs)
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in createIntent ${intentWs.transactionHash}`,
          properties: {
            intentHash: intentWs.transactionHash,
            error: e.message || e,
          },
        }),
      )

      // Track intent creation failure
      this.ecoAnalytics.trackIntentCreationFailed(intent, intentWs, e)
    }
  }

  async createIntentFromIntentInitiation(
    quoteID: string,
    funder: Hex,
    route: RouteType,
    reward: QuoteRewardDataModel,
  ) {
    try {
      const { salt, source, destination, inbox, tokens: routeTokens, calls } = route
      const { creator, prover, deadline, nativeValue, tokens: rewardTokens } = reward
      const intentHash = hashIntent({ route, reward }).intentHash

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `createIntentFromIntentInitiation`,
          properties: {
            intentHash,
          },
        }),
      )

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

      await this.intentModel.create({
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
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in createIntentFromIntentInitiation`,
          properties: {
            quoteID,
            error: ex.message,
          },
        }),
      )

      // Track gasless intent creation failure with complete context
      this.ecoAnalytics.trackGaslessIntentCreationError(ex, quoteID, funder, route, reward)
    }
  }

  /**
   * Fetch an intent from the db
   * @param query for fetching the intent
   * @returns the intent or an error
   */
  async getIntentForHash(hash: string): Promise<EcoResponse<IntentSourceModel>> {
    try {
      const { response: intent, error } = await this.fetchIntent({ 'intent.hash': hash })

      if (error) {
        this.ecoAnalytics.trackIntentRetrievalNotFound('getIntentForHash', { hash }, error)
        return { error }
      } else {
        this.ecoAnalytics.trackIntentRetrievalSuccess('getIntentForHash', {
          hash,
          intent,
        })
      }

      return { response: intent }
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
  async fetchIntent(query: object): Promise<EcoResponse<IntentSourceModel>> {
    try {
      const intent = await this.intentModel.findOne(query)

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
