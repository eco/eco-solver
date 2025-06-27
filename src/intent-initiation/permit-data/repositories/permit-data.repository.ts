import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { PermitData } from '@/intent-initiation/permit-data/schemas/permit-data.schema'

@Injectable()
export class PermitDataRepository {
  private logger = new EcoLogger(PermitDataRepository.name)

  constructor(@InjectModel(PermitData.name) private model: Model<PermitData>) {}

  async getPermitData(intentGroupID: string, projection: object = {}): Promise<PermitData | null> {
    return this.queryPermitDataEntry({ intentGroupID }, projection)
  }

  async exists(query: object): Promise<boolean> {
    const res = await this.model.exists(query)
    return Boolean(res)
  }

  async queryPermitDataEntry(query: object, projection: object = {}): Promise<PermitData | null> {
    return this.model.findOne(query, projection).lean()
  }

  async queryPermitDataEntries(query: object, projection: object = {}): Promise<PermitData[]> {
    return this.model.find(query, projection).lean()
  }

  async addPermitDataEntry(data: PermitData): Promise<boolean> {
    return this.createWithDupCheck(data, 'requestID')
  }

  private async createWithDupCheck(data: PermitData, indexForDupCheck: string): Promise<boolean> {
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

  private async create(data: PermitData): Promise<PermitData> {
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
    return rest as PermitData
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

  async update(query: object, updates: object, options?: object): Promise<PermitData | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as PermitData
    }

    return null
  }

  async deleteRequests(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }
}
