import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Document } from 'mongoose'
import { Hex } from 'viem'
import { BalanceRecord, BalanceRecordModel } from '../schemas/balance-record.schema'
import { BalanceFilter, BalanceStats } from '../types/balance.types'

export type CreateBalanceRecordParams = Omit<
  BalanceRecord,
  keyof Document | '_id' | 'createdAt' | 'updatedAt'
>

@Injectable()
export class BalanceRecordRepository {
  constructor(
    @InjectModel(BalanceRecord.name)
    private readonly balanceRecordModel: Model<BalanceRecordModel>,
  ) {}

  /**
   * Create a new balance record
   */
  async create(params: CreateBalanceRecordParams): Promise<BalanceRecordModel> {
    const balanceRecord = new this.balanceRecordModel({
      ...params,
      chainId: params.chainId.toString(),
      balance: params.balance.toString(),
      blockNumber: params.blockNumber.toString(),
    })
    return balanceRecord.save()
  }

  /**
   * Upsert a balance record (update if exists, create if not)
   */
  async upsert(params: CreateBalanceRecordParams): Promise<BalanceRecordModel> {
    const filter = {
      chainId: params.chainId.toString(),
      tokenAddress: params.tokenAddress,
      blockNumber: params.blockNumber.toString(),
    }

    const update = {
      ...params,
      chainId: params.chainId.toString(),
      balance: params.balance.toString(),
      blockNumber: params.blockNumber.toString(),
    }

    return this.balanceRecordModel
      .findOneAndUpdate(filter, update, { upsert: true, new: true })
      .exec()
  }

  /**
   * Find balance records by filters
   */
  async findByFilters(filters: BalanceFilter): Promise<BalanceRecordModel[]> {
    const query = this.buildQuery(filters)
    const queryBuilder = this.balanceRecordModel.find(query).sort({ timestamp: -1 })

    if (filters.limit) {
      queryBuilder.limit(filters.limit)
    }

    if (filters.offset) {
      queryBuilder.skip(filters.offset)
    }

    return queryBuilder.exec()
  }

  /**
   * Find the latest balance record for a specific token
   */
  async findLatestBalance(
    chainId: bigint,
    tokenAddress: Hex | 'native',
  ): Promise<BalanceRecordModel | null> {
    return this.balanceRecordModel
      .findOne({
        chainId: chainId.toString(),
        tokenAddress,
      })
      .sort({ blockNumber: -1, timestamp: -1 })
      .exec()
  }

  /**
   * Find balance at a specific block
   */
  async findBalanceAtBlock(
    chainId: bigint,
    tokenAddress: Hex | 'native',
    blockNumber: bigint,
  ): Promise<BalanceRecordModel | null> {
    return this.balanceRecordModel
      .findOne({
        chainId: chainId.toString(),
        tokenAddress,
        blockNumber: { $lte: blockNumber.toString() },
      })
      .sort({ blockNumber: -1 })
      .exec()
  }

  /**
   * Get balance history for a specific token
   */
  async getBalanceHistory(
    chainId: bigint,
    tokenAddress: Hex | 'native',
    limit = 100,
  ): Promise<BalanceRecordModel[]> {
    return this.balanceRecordModel
      .find({
        chainId: chainId.toString(),
        tokenAddress,
      })
      .sort({ blockNumber: -1, timestamp: -1 })
      .limit(limit)
      .exec()
  }

  /**
   * Get balance statistics for a specific token
   */
  async getBalanceStats(
    chainId: bigint,
    tokenAddress: Hex | 'native',
    fromDate?: Date,
    toDate?: Date,
  ): Promise<BalanceStats | null> {
    const matchQuery: any = {
      chainId: chainId.toString(),
      tokenAddress,
    }

    if (fromDate || toDate) {
      matchQuery.timestamp = {}
      if (fromDate) matchQuery.timestamp.$gte = fromDate
      if (toDate) matchQuery.timestamp.$lte = toDate
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          latestBalance: { $max: { $toLong: '$balance' } },
          oldestBalance: { $min: { $toLong: '$balance' } },
          averageBalance: { $avg: { $toLong: '$balance' } },
          latestTimestamp: { $max: '$timestamp' },
          oldestTimestamp: { $min: '$timestamp' },
        },
      },
    ]

    const result = await this.balanceRecordModel.aggregate(pipeline).exec()

    if (result.length === 0) {
      return null
    }

    const stats = result[0]

    // Calculate 24h change if we have data
    let balanceChange24h = BigInt(0)
    let balanceChangePercent24h = 0

    if (stats.totalRecords > 1) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const latestRecord = await this.findLatestBalance(chainId, tokenAddress)
      const historicalRecord = await this.balanceRecordModel
        .findOne({
          chainId: chainId.toString(),
          tokenAddress,
          timestamp: { $lte: twentyFourHoursAgo },
        })
        .sort({ timestamp: -1 })
        .exec()

      if (latestRecord && historicalRecord) {
        const latestBalance = BigInt(latestRecord.balance)
        const historicalBalance = BigInt(historicalRecord.balance)
        balanceChange24h = latestBalance - historicalBalance

        if (historicalBalance > 0) {
          balanceChangePercent24h =
            Number((balanceChange24h * BigInt(10000)) / historicalBalance) / 100
        }
      }
    }

    return {
      totalRecords: stats.totalRecords,
      latestBalance: BigInt(stats.latestBalance || 0),
      oldestBalance: BigInt(stats.oldestBalance || 0),
      averageBalance: BigInt(Math.floor(stats.averageBalance || 0)),
      balanceChange24h,
      balanceChangePercent24h,
    }
  }

  /**
   * Count balance records by filters
   */
  async countByFilters(filters: BalanceFilter): Promise<number> {
    const query = this.buildQuery(filters)
    return this.balanceRecordModel.countDocuments(query).exec()
  }

  /**
   * Delete old balance records (for data retention)
   */
  async deleteOldRecords(olderThan: Date): Promise<number> {
    const result = await this.balanceRecordModel
      .deleteMany({ timestamp: { $lt: olderThan } })
      .exec()
    return result.deletedCount || 0
  }

  /**
   * Check if a balance record exists for a specific block
   */
  async existsAtBlock(
    chainId: bigint,
    tokenAddress: Hex | 'native',
    blockNumber: bigint,
  ): Promise<boolean> {
    const count = await this.balanceRecordModel
      .countDocuments({
        chainId: chainId.toString(),
        tokenAddress,
        blockNumber: blockNumber.toString(),
      })
      .exec()
    return count > 0
  }

  /**
   * Find the latest balance records by block number for each unique token address on a given chain
   * Uses MongoDB aggregation pipeline for efficient querying
   */
  async findLatestBalanceRecordsByChain(chainId: bigint): Promise<BalanceRecordModel[]> {
    const pipeline: any[] = [
      // Match records for the specified chain
      {
        $match: {
          chainId: chainId.toString(),
        },
      },
      // Sort by block number in descending order to get latest first
      {
        $sort: {
          blockNumber: -1,
          timestamp: -1,
        },
      },
      // Group by token address and take the first (latest) record for each
      {
        $group: {
          _id: '$tokenAddress',
          latestRecord: { $first: '$$ROOT' },
        },
      },
      // Replace root with the latest record to flatten the structure
      {
        $replaceRoot: {
          newRoot: '$latestRecord',
        },
      },
      // Sort by token address for consistent ordering
      {
        $sort: {
          tokenAddress: 1,
        },
      },
    ]

    return this.balanceRecordModel.aggregate(pipeline).exec()
  }

  /**
   * Build MongoDB query from filters
   */
  private buildQuery(filters: BalanceFilter): Record<string, any> {
    const query: Record<string, any> = {}

    if (filters.chainId !== undefined) {
      query.chainId = filters.chainId.toString()
    }

    if (filters.tokenAddress !== undefined) {
      query.tokenAddress = filters.tokenAddress
    }

    if (filters.fromDate || filters.toDate) {
      query.timestamp = {}
      if (filters.fromDate) query.timestamp.$gte = filters.fromDate
      if (filters.toDate) query.timestamp.$lte = filters.toDate
    }

    return query
  }
}
