import { EcoAnalyticsService } from '@/analytics'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Hex } from 'viem'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { Model } from 'mongoose'
import { QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import { RewardTokensInterface, CallDataInterface } from '@/contracts'
import { RouteType, hashIntent } from '@eco-foundation/routes-ts'

@Injectable()
export class IntentSourceRepository {
  private logger = new EcoLogger(IntentSourceRepository.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private model: Model<IntentSourceModel>,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async create(data: any): Promise<IntentSourceModel> {
    return this.model.create(data)
  }

  async getIntent(hash: string, projection: object = {}): Promise<IntentSourceModel | null> {
    return this.queryIntent({ 'intent.hash': hash }, projection)
  }

  async getIntentsForGroupID(
    intentGroupID: string,
    projection: object = {},
  ): Promise<IntentSourceModel[]> {
    return this.queryIntents({ 'intent.intentGroupID': intentGroupID }, projection)
  }

  async createIntentFromIntentInitiation(
    intentGroupID: string,
    quoteID: string,
    funder: Hex,
    route: RouteType,
    reward: QuoteRewardDataType,
  ) {
    try {
      const { salt, source, destination, inbox, tokens: routeTokens, calls } = route
      const { creator, prover, deadline, nativeValue } = reward
      const rewardTokens = reward.tokens as RewardTokensInterface[]
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
        intentGroupID,
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

      await this.model.create({
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

  async exists(query: object): Promise<boolean> {
    const res = await this.model.exists(query)
    return Boolean(res)
  }

  async queryIntent(query: object, projection: object = {}): Promise<IntentSourceModel | null> {
    return this.model.findOne(query, projection).lean()
  }

  async queryIntents(query: object, projection: object = {}): Promise<IntentSourceModel[]> {
    return this.model.find(query, projection).lean()
  }

  async update(
    query: object,
    updates: object,
    options?: object,
  ): Promise<IntentSourceModel | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as IntentSourceModel
    }

    return null
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }
}
