import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BalanceRecord, BalanceRecordModel } from '../schemas/balance-record.schema'
import { BalanceChangeModel } from '../schemas/balance-change.schema'
import { BalanceChangeRepository } from './balance-change.repository'

@Injectable()
export class BalanceRecordRepository {
  private readonly logger = new Logger(BalanceRecordRepository.name)

  constructor(
    @InjectModel(BalanceRecord.name)
    public readonly balanceRecordModel: Model<BalanceRecordModel>,
    private readonly balanceChangeRepository: BalanceChangeRepository,
  ) {}

  /**
   * Update balance record from RPC call - only if block number is greater
   */
  async updateFromRpc(params: {
    chainId: string
    address: string
    balance: string
    blockNumber: string
    blockHash: string
    timestamp: Date
    decimals?: number
    tokenSymbol?: string
    tokenName?: string
  }): Promise<BalanceRecordModel | null> {
    const filter = {
      chainId: params.chainId,
      address: params.address,
    }

    // Use atomic findOneAndUpdate with a condition to only update if block number is greater
    // This prevents race conditions and duplicate updates for the same block
    const updateFilter = {
      ...filter,
      $or: [
        { blockNumber: { $exists: false } }, // Handle case where record doesn't exist
        { blockNumber: { $lt: params.blockNumber } }, // Only update if new block is greater
      ],
    }

    const update = {
      balance: params.balance,
      blockNumber: params.blockNumber,
      blockHash: params.blockHash,
      timestamp: params.timestamp,
      decimals: params.decimals,
      tokenSymbol: params.tokenSymbol,
      tokenName: params.tokenName,
    }

    try {
      const result = await this.balanceRecordModel
        .findOneAndUpdate(updateFilter, update, { upsert: true, new: true })
        .exec()

      if (!result) {
        // No update was made because block number wasn't greater, return existing record
        const existingRecord = await this.balanceRecordModel.findOne(filter).exec()
        if (existingRecord) {
          this.logger.debug(
            `Ignoring RPC update for ${params.chainId}:${params.address} - ` +
              `block ${params.blockNumber} is not greater than current block ${existingRecord.blockNumber}`,
          )
        }
        return existingRecord
      }

      return result
    } catch (error) {
      // Handle duplicate key errors gracefully - this can happen during race conditions
      if (error.code === 11000) {
        this.logger.warn(
          `Duplicate key error for ${params.chainId}:${params.address} block ${params.blockNumber} - ` +
            `returning existing record`,
        )
        // Return the existing record
        return this.balanceRecordModel.findOne(filter).exec()
      }
      throw error
    }
  }

  /**
   * Create a balance change record - delegates to BalanceChangeRepository
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
    return this.balanceChangeRepository.createBalanceChange(params)
  }

  /**
   * Get current balance for chainId/address/block
   * Fetches balance record and calculates all balance changes from the specified block
   * Defaults to latest (largest) block if no block specified
   */
  async getCurrentBalance(
    chainId: string,
    address: string,
    blockNumber?: string,
  ): Promise<{ balance: bigint; blockNumber: string } | null> {
    // Get the balance record
    const balanceRecord = await this.balanceRecordModel
      .findOne({
        chainId,
        address,
      })
      .exec()

    if (!balanceRecord) {
      return null
    }

    // Use the specified block number or default to the balance record's block number (latest)
    const targetBlockNumber = blockNumber || balanceRecord.blockNumber

    // Get the outstanding balance from the balance change repository
    const outstandingBalance = await this.balanceChangeRepository.calculateOutstandingBalance(
      chainId,
      address,
      targetBlockNumber,
    )

    // Start with the balance record's balance and add the outstanding changes
    const currentBalance = BigInt(balanceRecord.balance) + outstandingBalance

    return {
      balance: currentBalance,
      blockNumber: targetBlockNumber,
    }
  }

  /**
   * Get balance record by chainId and address
   */
  async findByChainAndAddress(
    chainId: string,
    address: string,
  ): Promise<BalanceRecordModel | null> {
    return this.balanceRecordModel
      .findOne({
        chainId,
        address,
      })
      .exec()
  }

  /**
   * Get all balance records for a chain
   */
  async findByChain(chainId: string): Promise<BalanceRecordModel[]> {
    return this.balanceRecordModel
      .find({
        chainId,
      })
      .sort({ address: 1 })
      .exec()
  }
}
