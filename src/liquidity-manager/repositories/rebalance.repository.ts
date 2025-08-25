import { EcoLogger } from '@/common/logging/eco-logger'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class RebalanceRepository {
  private logger = new EcoLogger(RebalanceRepository.name)

  constructor(@InjectModel(RebalanceModel.name) private model: Model<RebalanceModel>) {}

  async queryRebalances(query: object, projection: object = {}): Promise<RebalanceModel[]> {
    return this.model.find(query, projection)
  }

  async create(rebalanceModel: RebalanceModel): Promise<RebalanceModel> {
    return this.model.create(rebalanceModel)
  }

  async updateStatus(
    rebalanceJobID: string,
    status: RebalanceStatus,
  ): Promise<RebalanceModel | null> {
    return this.update({ rebalanceJobID }, { status: status.toString() })
  }

  async update(query: object, updates: object, options?: object): Promise<RebalanceModel | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as RebalanceModel
    }

    return null
  }

  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }

  async insertMany(models: RebalanceModel[]): Promise<any> {
    return this.model.insertMany(models)
  }

  async deleteMany(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }
}
