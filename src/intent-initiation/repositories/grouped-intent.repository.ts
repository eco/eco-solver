import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { GroupedIntent } from '@/intent-initiation/schemas/grouped-intent.schema'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

@Injectable()
export class GroupedIntentRepository {
  private logger = new EcoLogger(GroupedIntentRepository.name)

  constructor(@InjectModel(GroupedIntent.name) private model: Model<GroupedIntent>) {}

  async getIntentForGroupID(
    intentGroupID: string,
    projection: object = {},
  ): Promise<EcoResponse<GroupedIntent>> {
    const intent = await this.queryIntent({ intentGroupID }, projection)

    if (!intent) {
      return { error: EcoError.IntentNotFound }
    }

    return { response: intent }
  }

  async getIntentForTransactionHash(
    txHash: string,
    projection: object = {},
  ): Promise<GroupedIntent | null> {
    return this.queryIntent({ destinationChainTxHash: txHash }, projection)
  }

  async exists(query: object): Promise<boolean> {
    const res = await this.model.exists(query)
    return Boolean(res)
  }

  async queryIntent(query: object, projection: object = {}): Promise<GroupedIntent | null> {
    return this.model.findOne(query, projection).lean()
  }

  async queryIntents(query: object, projection: object = {}): Promise<GroupedIntent[]> {
    return this.model.find(query, projection).lean()
  }

  async addIntent(data: GroupedIntent): Promise<boolean> {
    return this.createWithDupCheck(data, 'intentGroupID')
  }

  private async createWithDupCheck(
    data: GroupedIntent,
    indexForDupCheck: string,
  ): Promise<boolean> {
    try {
      await this.create(data)
      return false
    } catch (ex) {
      const isDuplicate = this.isDuplicateInsert(ex, indexForDupCheck)
      if (isDuplicate) {
        return true
      }

      throw ex
    }
  }

  private async create(data: GroupedIntent): Promise<GroupedIntent> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `create`,
        properties: {
          data,
        },
      }),
    )

    const newInstance = new this.model(data)
    await newInstance.save()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = newInstance.toObject({ versionKey: false })
    return rest as GroupedIntent
  }

  private isDuplicateInsert(exception: any, indexForDupCheck?: string): boolean {
    const { message } = exception
    const duplicateErrorMessage = message && message.includes('duplicate key') ? message : undefined

    if (!duplicateErrorMessage) {
      return false
    }

    if (!indexForDupCheck) {
      return true
    }

    return message.includes(`index: ${indexForDupCheck}`) ? true : false
  }

  async updateIntent(
    intentGroupID: string,
    updates: object,
    options?: object,
  ): Promise<GroupedIntent | null> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `updateIntent`,
        properties: {
          intentGroupID,
          updates,
          options,
        },
      }),
    )

    const query = { intentGroupID }
    return this.update(query, updates, options)
  }

  async update(query: object, updates: object, options?: object): Promise<GroupedIntent | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as GroupedIntent
    }

    return null
  }

  async deleteIntents(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }
}
