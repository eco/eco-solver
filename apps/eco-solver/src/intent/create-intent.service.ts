import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '@libs/solver-config'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { QUEUES } from '../common/redis/constants'
import { JobsOptions, Queue } from 'bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { getIntentJobId } from '../common/utils/strings'
import { Hex } from 'viem'
import { ValidSmartWalletService } from '../solver/filters/valid-smart-wallet.service'
import {
  CallDataInterface,
  decodeCreateIntentLog,
  IntentCreatedLog,
  RewardTokensInterface,
} from '../contracts'
import { IntentDataModel } from './schemas/intent-data.schema'
import { FlagService } from '../flags/flags.service'
import { deserialize, Serialize } from '@eco-solver/common/utils/serialize'
import { hashIntent, RouteType } from '@eco-foundation/routes-ts'
import { QuoteRewardDataModel } from '@eco-solver/quote/schemas/quote-reward.schema'
import { EcoResponse } from '@eco-solver/common/eco-response'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoAnalyticsService } from '@eco-solver/analytics'

/**
 * This service is responsible for creating a new intent record in the database. It is
 * triggered when a new intent is created recieved in {@link WatchIntentService}.
 * It validates that the record doesn't exist yet, and that its creator is a valid BEND wallet
 */
@Injectable()
export class CreateIntentService implements OnModuleInit {
  private logger = new Logger(CreateIntentService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
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
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in createIntent ${intentWs.transactionHash}`,
          properties: {
            intentHash: intentWs.transactionHash,
            error: e,
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
