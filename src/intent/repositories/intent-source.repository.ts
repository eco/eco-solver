import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types, Document } from 'mongoose'
import { Hex } from 'viem'
import { IntentSourceModel, IntentSourceStatus } from '../schemas/intent-source.schema'

export type CreateIntentSourceParams = Omit<
  IntentSourceModel,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'receipt'
> & {
  receipt?: any
}

export interface IntentSourceFilters {
  status?: IntentSourceStatus
  fulfilledBySelf?: boolean
  intentHash?: Hex
  'intent.hash'?: Hex
  withdrawalId?: Types.ObjectId
  hasWithdrawal?: boolean
}

@Injectable()
export class IntentSourceRepository {
  constructor(
    @InjectModel(IntentSourceModel.name)
    private readonly intentSourceModel: Model<IntentSourceModel>,
  ) {}

  /**
   * Create a new intent source record
   */
  async create(params: CreateIntentSourceParams): Promise<IntentSourceModel> {
    const intentSource = new this.intentSourceModel(params)
    return intentSource.save()
  }

  /**
   * Find intent sources by filters
   */
  async findByFilters(filters: IntentSourceFilters): Promise<IntentSourceModel[]> {
    const query = this.buildQuery(filters)
    return this.intentSourceModel.find(query).sort({ createdAt: -1 }).exec()
  }

  /**
   * Find a single intent source by filters
   */
  async findOneByFilters(filters: IntentSourceFilters): Promise<IntentSourceModel | null> {
    const query = this.buildQuery(filters)
    return this.intentSourceModel.findOne(query).exec()
  }

  /**
   * Find intent sources that are fulfilled by self with the specified status
   */
  async findSelfFulfilledByStatus(status: IntentSourceStatus): Promise<IntentSourceModel[]> {
    return this.intentSourceModel
      .find({
        fulfilledBySelf: true,
        status: status,
      })
      .sort({ createdAt: -1 })
      .exec()
  }

  /**
   * Find intent source by intent hash
   */
  async findByIntentHash(intentHash: Hex): Promise<IntentSourceModel | null> {
    return this.intentSourceModel.findOne({ 'intent.hash': intentHash }).exec()
  }

  /**
   * Find intent source by intent hash with withdrawal populated
   */
  async findByIntentHashWithWithdrawal(intentHash: Hex): Promise<IntentSourceModel | null> {
    return this.intentSourceModel
      .findOne({ 'intent.hash': intentHash })
      .populate('withdrawalId')
      .exec()
  }

  /**
   * Find intent sources with withdrawals
   */
  async findWithWithdrawals(): Promise<IntentSourceModel[]> {
    return this.intentSourceModel
      .find({ withdrawalId: { $exists: true, $ne: null } })
      .populate('withdrawalId')
      .sort({ createdAt: -1 })
      .exec()
  }

  /**
   * Update an intent source
   */
  async update(
    id: Types.ObjectId,
    updates: Partial<IntentSourceModel>,
  ): Promise<IntentSourceModel | null> {
    return this.intentSourceModel.findByIdAndUpdate(id, updates, { new: true }).exec()
  }

  /**
   * Update an intent source by intent hash
   */
  async updateByIntentHash(
    intentHash: Hex,
    updates: Partial<IntentSourceModel>,
  ): Promise<IntentSourceModel | null> {
    return this.intentSourceModel
      .findOneAndUpdate({ 'intent.hash': intentHash }, updates, { new: true })
      .exec()
  }

  /**
   * Count intent sources by filters
   */
  async countByFilters(filters: IntentSourceFilters): Promise<number> {
    const query = this.buildQuery(filters)
    return this.intentSourceModel.countDocuments(query).exec()
  }

  /**
   * Get statistics for self-fulfilled intents by status
   */
  async getSelfFulfilledStats(): Promise<{
    totalSelfFulfilled: number
    byStatus: Record<string, number>
  }> {
    const pipeline = [
      { $match: { fulfilledBySelf: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]

    const result = await this.intentSourceModel.aggregate(pipeline).exec()

    const byStatus: Record<string, number> = {}
    let totalSelfFulfilled = 0

    for (const item of result) {
      byStatus[item._id] = item.count
      totalSelfFulfilled += item.count
    }

    return {
      totalSelfFulfilled,
      byStatus,
    }
  }

  /**
   * Build MongoDB query from filters
   */
  private buildQuery(filters: IntentSourceFilters): Record<string, any> {
    const query: Record<string, any> = {}

    if (filters.status !== undefined) {
      query.status = filters.status
    }

    if (filters.fulfilledBySelf !== undefined) {
      query.fulfilledBySelf = filters.fulfilledBySelf
    }

    if (filters.intentHash) {
      query['intent.hash'] = filters.intentHash
    }

    if (filters['intent.hash']) {
      query['intent.hash'] = filters['intent.hash']
    }

    if (filters.withdrawalId) {
      query.withdrawalId = filters.withdrawalId
    }

    if (filters.hasWithdrawal !== undefined) {
      if (filters.hasWithdrawal) {
        query.withdrawalId = { $exists: true, $ne: null }
      } else {
        query.withdrawalId = { $exists: false }
      }
    }

    return query
  }
}
