import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Document } from 'mongoose'
import { BalanceChange, BalanceChangeModel } from '../schemas/balance-change.schema'

export type CreateBalanceChangeParams = Omit<
  BalanceChange,
  keyof Document | '_id' | 'createdAt' | 'updatedAt'
>

@Injectable()
export class BalanceChangeRepository {
  constructor(
    @InjectModel(BalanceChange.name)
    private readonly balanceChangeModel: Model<BalanceChangeModel>,
  ) {}

  /**
   * Create a new balance change record
   */
  async create(params: CreateBalanceChangeParams): Promise<BalanceChangeModel | null> {
    try {
      const balanceChange = new this.balanceChangeModel({
        ...params,
        chainId: params.chainId.toString(),
        changeAmount: params.changeAmount.toString(),
        blockNumber: params.blockNumber.toString(),
      })
      return balanceChange.save()
    } catch (error) {
      // Handle duplicate key errors gracefully (same transaction/logIndex)
      if (error.code === 11000) {
        return null // Change already recorded
      }
      throw error
    }
  }

  /**
   * Create a balance change record from watch services
   */
  async createBalanceChange(params: {
    chainId: string
    address: string
    changeAmount: string
    direction: 'incoming' | 'outgoing'
    blockNumber: string
    blockHash: string
    transactionHash: string
    timestamp: Date
    from?: string
    to?: string
  }): Promise<BalanceChangeModel> {
    const balanceChange = new this.balanceChangeModel(params)
    return balanceChange.save()
  }

  /**
   * Get all balance changes for a specific address on a chain from a specific block number
   */
  async getBalanceChangesSince(
    chainId: string,
    address: string,
    blockNumber: string,
  ): Promise<BalanceChangeModel[]> {
    const query: any = {
      chainId,
      address,
      blockNumber: { $gte: blockNumber },
    }
    return this.balanceChangeModel.find(query).sort({ blockNumber: 1, timestamp: 1 }).exec()
  }

  /**
   * Calculate the current outstanding balance from all balance changes from a specific block number
   */
  async calculateOutstandingBalance(
    chainId: string,
    address: string,
    blockNumber: string,
  ): Promise<bigint> {
    const pipeline: any[] = [
      {
        $match: {
          chainId,
          address,
          blockNumber: { $gte: blockNumber },
        },
      },
      {
        $group: {
          _id: null,
          totalIncoming: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'incoming'] }, { $toLong: '$changeAmount' }, 0],
            },
          },
          totalOutgoing: {
            $sum: {
              $cond: [{ $eq: ['$direction', 'outgoing'] }, { $toLong: '$changeAmount' }, 0],
            },
          },
        },
      },
      {
        $project: {
          outstandingBalance: { $subtract: ['$totalIncoming', '$totalOutgoing'] },
        },
      },
    ]

    const result = await this.balanceChangeModel.aggregate(pipeline).exec()

    if (result.length === 0) {
      return 0n
    }

    return BigInt(result[0].outstandingBalance || 0)
  }
}
