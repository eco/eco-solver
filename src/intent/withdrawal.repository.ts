import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Hex } from 'viem'
import { WithdrawalModel } from './schemas/withdrawal.schema'
import { WatchEventModel } from './schemas/watch-event.schema'
import { Network } from '@/common/alchemy/network'

export interface CreateWithdrawalParams {
  event: WatchEventModel
  intentHash: Hex
  intentId: Types.ObjectId
  recipient: Hex
}

export interface WithdrawalFilters {
  recipient?: Hex
  intentHash?: Hex
  intentId?: Types.ObjectId
  sourceChainId?: string
  sourceNetwork?: Network
  transactionHash?: Hex
  logIndex?: number
}

@Injectable()
export class WithdrawalRepository {
  constructor(
    @InjectModel(WithdrawalModel.name) private readonly withdrawalModel: Model<WithdrawalModel>,
  ) {}

  /**
   * Create a new withdrawal record
   */
  async create(params: CreateWithdrawalParams): Promise<WithdrawalModel> {
    const withdrawal = new this.withdrawalModel({
      ...params,
      processedAt: new Date(),
    })
    return withdrawal.save()
  }

  /**
   * Find withdrawals by filters
   */
  async findByFilters(filters: WithdrawalFilters): Promise<WithdrawalModel[]> {
    const query = this.buildQuery(filters)
    return this.withdrawalModel.find(query).populate('intentId').sort({ createdAt: -1 }).exec()
  }

  /**
   * Find a single withdrawal by filters
   */
  async findOneByFilters(filters: WithdrawalFilters): Promise<WithdrawalModel | null> {
    const query = this.buildQuery(filters)
    return this.withdrawalModel.findOne(query).populate('intentId').exec()
  }

  /**
   * Find withdrawals by recipient
   */
  async findByRecipient(recipient: Hex): Promise<WithdrawalModel[]> {
    return this.findByFilters({ recipient })
  }

  /**
   * Find withdrawals by intent hash
   */
  async findByIntentHash(intentHash: Hex): Promise<WithdrawalModel[]> {
    return this.findByFilters({ intentHash })
  }

  /**
   * Find withdrawal by transaction hash and log index (should be unique)
   */
  async findByTransactionAndLogIndex(
    transactionHash: Hex,
    logIndex: number,
  ): Promise<WithdrawalModel | null> {
    return this.withdrawalModel
      .findOne({
        'event.transactionHash': transactionHash,
        'event.logIndex': logIndex,
      })
      .populate('intentId')
      .exec()
  }

  /**
   * Check if withdrawal already exists
   */
  async exists(transactionHash: Hex, logIndex: number): Promise<boolean> {
    const count = await this.withdrawalModel
      .countDocuments({
        'event.transactionHash': transactionHash,
        'event.logIndex': logIndex,
      })
      .exec()
    return count > 0
  }

  /**
   * Get withdrawal statistics by recipient
   */
  async getStatsByRecipient(recipient: Hex): Promise<{
    totalWithdrawals: number
    uniqueIntents: number
    latestWithdrawal: Date | null
  }> {
    const pipeline = [
      { $match: { recipient } },
      {
        $group: {
          _id: null,
          totalWithdrawals: { $sum: 1 },
          uniqueIntents: { $addToSet: '$intentHash' },
          latestWithdrawal: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          totalWithdrawals: 1,
          uniqueIntents: { $size: '$uniqueIntents' },
          latestWithdrawal: 1,
        },
      },
    ]

    const result = await this.withdrawalModel.aggregate(pipeline).exec()

    if (result.length === 0) {
      return {
        totalWithdrawals: 0,
        uniqueIntents: 0,
        latestWithdrawal: null,
      }
    }

    return result[0]
  }

  /**
   * Build MongoDB query from filters
   */
  private buildQuery(filters: WithdrawalFilters): Record<string, any> {
    const query: Record<string, any> = {}

    if (filters.recipient) {
      query.recipient = filters.recipient
    }

    if (filters.intentHash) {
      query.intentHash = filters.intentHash
    }

    if (filters.intentId) {
      query.intentId = filters.intentId
    }

    if (filters.sourceChainId) {
      query['event.sourceChainID'] = BigInt(filters.sourceChainId)
    }

    if (filters.sourceNetwork) {
      query['event.sourceNetwork'] = filters.sourceNetwork
    }

    if (filters.transactionHash) {
      query['event.transactionHash'] = filters.transactionHash
    }

    if (filters.logIndex !== undefined) {
      query['event.logIndex'] = filters.logIndex
    }

    return query
  }
}
