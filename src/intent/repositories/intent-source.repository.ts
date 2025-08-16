import { EcoLogger } from '@/common/logging/eco-logger'
import { FilterQuery, HydratedDocument, Model } from 'mongoose'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel, IntentSourceStatus } from '@/intent/schemas/intent-source.schema'

export interface IntentFilter {
  status?: IntentSourceStatus | IntentSourceStatus[]
  createdAfter?: Date
  createdBefore?: Date
  updatedAfter?: Date
  updatedBefore?: Date
  routeToken?: string
  rewardToken?: string
  requireNonExpired?: boolean
  callTarget?: string
  requireTransferSelector?: boolean
  requireZeroCallValue?: boolean
}

interface DateRangeFilterParams {
  queryKey: string
  afterKey: string
  beforeKey: string
}

type IntentSourceDocument = HydratedDocument<IntentSourceModel>

@Injectable()
export class IntentSourceRepository {
  private logger = new EcoLogger(IntentSourceRepository.name)

  constructor(@InjectModel(IntentSourceModel.name) private model: Model<IntentSourceModel>) {}

  async getIntent(hash: string, projection: object = {}): Promise<IntentSourceModel | null> {
    return this.queryIntent({ 'intent.hash': hash }, projection)
  }

  async exists(query: object): Promise<boolean> {
    const res = await this.model.exists(query)
    return Boolean(res)
  }

  async queryIntent(query: object, projection: object = {}): Promise<IntentSourceModel | null> {
    const rawResult = await this.model.findOne(query, projection)
    return rawResult ? this.fixIntentQueryResult(rawResult) : null
  }

  async queryIntents(query: object, projection: object = {}): Promise<IntentSourceModel[]> {
    const rawResults = await this.model.find(query, projection)
    return rawResults.map((doc) => this.fixIntentQueryResult(doc))
  }

  async create(intent: IntentSourceModel): Promise<IntentSourceModel> {
    const createdIntent = await this.model.create(intent)
    return this.fixIntentQueryResult(createdIntent)
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

  async insertMany(models: IntentSourceModel[]): Promise<any> {
    return this.model.insertMany(models)
  }

  async deleteMany(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }

  async filterIntents(filter: IntentFilter): Promise<IntentSourceModel[]> {
    const query: FilterQuery<IntentSourceModel> = {}

    // 1. Filter by intent status (single or multiple)
    if (filter.status) {
      query.status = Array.isArray(filter.status) ? { $in: filter.status } : filter.status
    }

    // 2. Filter by expiration
    const nowInSeconds = Math.floor(Date.now() / 1000)

    if (filter.requireNonExpired) {
      query['intent.reward.deadline'] = { $gt: BigInt(nowInSeconds) }
    }

    // 3. Filter by creation time
    this.addCreatedDateRangeFilter(filter, query)

    // 4. Filter by update time
    this.addUpdatedDateRangeFilter(filter, query)

    // 5. Filter by route token
    if (filter.routeToken) {
      query['intent.route.tokens.token'] = filter.routeToken
    }

    // 6. Filter by reward token
    if (filter.rewardToken) {
      query['intent.reward.tokens.token'] = filter.rewardToken
    }

    // 7. Filter by single transfer call
    this.addCallTargetsFilter(filter, query)

    const rawResults = await this.model.find(query)
    const intents: IntentSourceModel[] = rawResults.map((doc) => this.fixIntentQueryResult(doc))

    return intents
  }

  private fixIntentQueryResult(doc: IntentSourceDocument): IntentSourceModel {
    const intentSourceModel = doc.toObject({ versionKey: false }) as IntentSourceModel

    intentSourceModel.intent.route.tokens.forEach((token) => {
      token.amount = BigInt(token.amount.toString())
    })

    intentSourceModel.intent.reward.tokens.forEach((token) => {
      token.amount = BigInt(token.amount.toString())
    })

    return intentSourceModel
  }

  private addCreatedDateRangeFilter(filter: IntentFilter, query: FilterQuery<IntentSourceModel>) {
    this._addDateRangeFilter(filter, query, {
      queryKey: 'createdAt',
      afterKey: 'createdAfter',
      beforeKey: 'createdBefore',
    })
  }

  private addUpdatedDateRangeFilter(filter: IntentFilter, query: FilterQuery<IntentSourceModel>) {
    this._addDateRangeFilter(filter, query, {
      queryKey: 'updatedAt',
      afterKey: 'updatedAfter',
      beforeKey: 'updatedBefore',
    })
  }

  private _addDateRangeFilter(
    filter: IntentFilter,
    query: FilterQuery<IntentSourceModel>,
    params: DateRangeFilterParams,
  ) {
    const { queryKey, afterKey, beforeKey } = params

    if (!(filter[afterKey] || filter[beforeKey])) {
      return
    }

    query[queryKey] = {}

    if (filter[afterKey]) {
      query[queryKey].$gte = filter[afterKey]
    }

    if (filter[beforeKey]) {
      query[queryKey].$lte = filter[beforeKey]
    }
  }

  private addCallTargetsFilter(filter: IntentFilter, query: FilterQuery<IntentSourceModel>) {
    if (!(filter.callTarget || filter.requireTransferSelector || filter.requireZeroCallValue)) {
      return
    }

    query['intent.route.calls'] = { $size: 1 }

    if (filter.callTarget) {
      query['intent.route.calls.0.target'] = filter.callTarget
    }

    if (filter.requireTransferSelector) {
      query['intent.route.calls.0.data'] = { $regex: /^0xa9059cbb/i }
    }

    if (filter.requireZeroCallValue) {
      query['intent.route.calls.0.value'] = BigInt(0)
    }
  }
}
