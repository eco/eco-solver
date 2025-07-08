import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Hex } from 'viem'
import { IntentSourceModel, IntentSourceStatus } from '@/intent/schemas/intent-source.schema'
import { CreateModelParamsWithExclusions } from '@/common/db/utils'
import { HexNative } from '../../balance/schemas/balance-record.schema'

export type CreateIntentSourceParams = CreateModelParamsWithExclusions<
  IntentSourceModel,
  'receipt'
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

export interface ChainTokenFilters {
  chainId: bigint
  tokenAddress?: Hex // If undefined, includes native gas token rewards
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
   * Find self-fulfilled SOLVED intents for a specific source chain and token
   * @param chainId The source chain ID to search for
   * @param tokenAddress The token address (undefined for native gas token)
   */
  async findSelfFulfilledSolvedByChainAndToken(
    chainId: bigint,
    tokenAddress?: Hex,
  ): Promise<IntentSourceModel[]> {
    const matchConditions: any = {
      fulfilledBySelf: true,
      status: 'SOLVED',
      $or: [{ 'intent.route.source': chainId }],
    }

    // If tokenAddress is provided, match specific token in reward tokens
    // If not provided, match intents with native value > 0
    if (tokenAddress) {
      matchConditions['intent.reward.tokens.token'] = tokenAddress
    } else {
      matchConditions['intent.reward.nativeValue'] = { $gt: 0 }
    }

    return this.intentSourceModel.find(matchConditions).sort({ createdAt: -1 }).exec()
  }

  /**
   * Calculate the total reward amount for self-fulfilled SOLVED intents on a specific source chain and token
   * @param chainId The source chain ID to search for
   * @param tokenAddress The token address (undefined for native gas token)
   * @returns The total reward amount as bigint
   */
  async calculateTotalRewardsForChainAndToken(
    chainId: bigint,
    tokenAddress?: HexNative,
  ): Promise<bigint> {
    const matchConditions: any = {
      fulfilledBySelf: true,
      status: 'SOLVED',
      $or: [{ 'intent.route.source': chainId }],
    }

    let pipeline: any[]

    if (tokenAddress) {
      // For specific ERC20 token rewards
      pipeline = [
        { $match: matchConditions },
        { $unwind: '$intent.reward.tokens' },
        {
          $match: {
            'intent.reward.tokens.token': tokenAddress,
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.tokens.amount',
              },
            },
          },
        },
      ]
    } else {
      // For native gas token rewards
      matchConditions['intent.reward.nativeValue'] = { $gt: 0 }
      pipeline = [
        { $match: matchConditions },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.nativeValue',
              },
            },
          },
        },
      ]
    }

    const result = await this.intentSourceModel.aggregate(pipeline).exec()

    if (result.length === 0) {
      return BigInt(0)
    }

    return BigInt(result[0].totalAmount || 0)
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
