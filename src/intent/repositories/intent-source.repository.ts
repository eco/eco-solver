import { EcoLogger } from '@/common/logging/eco-logger'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { Model } from 'mongoose'

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
    return this.model.findOne(query, projection).lean()
  }

  async queryIntents(query: object, projection: object = {}): Promise<IntentSourceModel[]> {
    return this.model.find(query, projection).lean()
  }

  async update(query: object, updates: object, options?: object): Promise<IntentSourceModel | null> {
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
