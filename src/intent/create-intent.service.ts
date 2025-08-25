import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
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
  decodeSolanaIntentLogForCreateIntent,
} from '../contracts'
import { IntentDataModel } from './schemas/intent-data.schema'
import { FlagService } from '../flags/flags.service'
import { deserialize, Serialize } from '@/common/utils/serialize'
import { RouteType } from '@eco-foundation/routes-ts'
import { hashIntent } from '@/intent/check-funded-solana'
import { QuoteRewardDataModel } from '@/quote/schemas/quote-reward.schema'
import { EcoResponse } from '@/common/eco-response'
import { EcoError } from '@/common/errors/eco-error'
import { getVmType, VmType } from '@/eco-configs/eco-config.types'

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
    const intentWs = deserialize(serializedIntentWs);

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `createIntent ${intentWs.transactionHash}`,
        properties: {
          transactionHash: intentWs.transactionHash,
          intentHash: intentWs.args?.intentHash,
        },
      }),
    )

    let ei: any;
    if (getVmType(Number(intentWs.sourceChainID)) === VmType.SVM) {
      ei = decodeSolanaIntentLogForCreateIntent(intentWs)
    } else {
      ei = decodeCreateIntentLog(intentWs.data, intentWs.topics)
    }
    const intent = IntentDataModel.fromEvent(ei, intentWs.logIndex || 0)

    try {
      //check db if the intent is already filled
      let model;
      try {
        model = await this.intentModel.findOne({
          'intent.hash': intent.hash,
        })
      } catch (dbError) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Database query failed for intent hash ${intent.hash}`,
            properties: {
              intentHash: intent.hash,
              queryError: dbError instanceof Error ? { message: dbError.message, stack: dbError.stack } : dbError,
              query: { 'intent.hash': intent.hash },
            },
          }),
        )
        throw dbError;
      }

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
        return
      }

      // Skip smart wallet validation for Solana (SVM) chains
      const isSolanaChain = getVmType(Number(intentWs.sourceChainID)) === VmType.SVM
      let validWallet = this.flagService.getFlagValue('bendWalletOnly') && !isSolanaChain
        ? await this.validSmartWalletService.validateSmartWallet(
            intent.reward.creator as Hex,
            intentWs.sourceChainID,
          )
        : true
      // TODO: fix this
      validWallet = true

      intentWs.data = JSON.stringify(intentWs.data) as Hex

      //create db record
      const record = await this.intentModel.create({
        event: intentWs,
        intent: intent,
        receipt: null,
        status: validWallet ? 'PENDING' : 'NON-BEND-WALLET',
      })
      console.log("SAQUON record", record);

      const jobId = getIntentJobId('create', intent.hash as Hex, intent.logIndex)
      if (validWallet) {
        //add to processing queue
        await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, intent.hash, {
          jobId,
          ...this.intentJobConfig,
        })
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
            error: e instanceof Error ? { message: e.message, stack: e.stack, name: e.name } : e,
            intentData: intent,
          },
        }),
      )
    }
  }

  async createIntentFromIntentInitiation(
    quoteID: string,
    funder: Hex,
    source: bigint,
    destination: bigint,
    route: RouteType,
    reward: QuoteRewardDataModel,
  ) {
    try {
      const { salt, portal, tokens: routeTokens, calls } = route
      const { creator, prover, deadline, nativeAmount, tokens: rewardTokens } = reward
      const intentHash = hashIntent(destination, route, reward).intentHash

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `createIntentFromIntentInitiation`,
          properties: {
            intentHash,
          },
        }),
      )

      const intent = new IntentDataModel({
        quoteID,
        hash: intentHash,
        salt,
        source,
        destination,
        inbox: portal as Hex,
        routeTokens: routeTokens as RewardTokensInterface[],
        calls: calls as CallDataInterface[],
        creator,
        prover,
        deadline,
        nativeValue: nativeAmount,
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
    }
  }

  /**
   * Fetch an intent from the db
   * @param query for fetching the intent
   * @returns the intent or an error
   */
  async getIntentForHash(hash: string): Promise<EcoResponse<IntentSourceModel>> {
    return this.fetchIntent({ 'intent.hash': hash })
  }

  /**
   * Fetch an intent from the db
   * @param query for fetching the intent
   * @returns the intent or an error
   */
  async fetchIntent(query: object): Promise<EcoResponse<IntentSourceModel>> {
    const intent = await this.intentModel.findOne(query)

    if (!intent) {
      return { error: EcoError.IntentNotFound }
    }

    return { response: intent }
  }
}

