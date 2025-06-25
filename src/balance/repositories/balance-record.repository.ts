import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BalanceRecord, BalanceRecordModel } from '../schemas/balance-record.schema'
import { BalanceChangeModel } from '../schemas/balance-change.schema'
import { BalanceChangeRepository } from './balance-change.repository'
import { BalanceChange } from '../schemas/balance-change.schema'
import { CreateModelParams } from '@/common/db/utils'

// Extract type from BalanceRecord schema, excluding Document fields
export type UpdateFromRpcParams = CreateModelParams<BalanceRecord>

// Extract type from BalanceChange schema, excluding Document fields
export type CreateBalanceChangeParams = CreateModelParams<BalanceChange>

export interface GetCurrentBalanceResult {
  balance: bigint
  blockNumber: string
}

/**
 * Repository for managing balance records - the base balance state for addresses
 *
 * This repository handles:
 * - Creating and updating balance records from RPC calls
 * - Calculating current balances by combining base records with balance changes
 * - Ensuring atomic updates and race condition handling
 * - Delegating balance change operations to BalanceChangeRepository
 */
@Injectable()
export class BalanceRecordRepository {
  private readonly logger = new Logger(BalanceRecordRepository.name)

  constructor(
    @InjectModel(BalanceRecord.name)
    public readonly balanceRecordModel: Model<BalanceRecordModel>,
    private readonly balanceChangeRepository: BalanceChangeRepository,
  ) {}

  /**
   * Updates a balance record from an RPC call, ensuring block number monotonicity
   *
   * Uses atomic findOneAndUpdate with conditional logic to prevent race conditions
   * and ensure we only update when the new block number is greater than the existing one.
   *
   * @param params The balance update parameters
   * @returns The updated balance record or null if update failed
   */
  async updateFromRpc(params: UpdateFromRpcParams): Promise<BalanceRecordModel | null> {
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
      decimals: params.decimals,
      tokenSymbol: params.tokenSymbol,
      tokenName: params.tokenName,
    }

    try {
      // First, try to update with the condition
      const result = await this.balanceRecordModel
        .findOneAndUpdate(updateFilter, update, { new: true })
        .exec()

      if (result) {
        // Update was successful
        return result
      }

      // No update was made, check if record exists
      const existingRecord = await this.balanceRecordModel.findOne(filter).exec()

      if (existingRecord) {
        // Record exists but block number wasn't greater
        this.logger.debug(
          `Ignoring RPC update for ${params.chainId}:${params.address} - ` +
            `block ${params.blockNumber} is not greater than current block ${existingRecord.blockNumber}`,
        )
        return existingRecord
      }

      // Record doesn't exist, create it with upsert
      return await this.balanceRecordModel
        .findOneAndUpdate(filter, update, { upsert: true, new: true })
        .exec()
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
   * Creates a balance change record by delegating to BalanceChangeRepository
   *
   * This method provides a convenient interface for creating balance changes
   * while maintaining separation of concerns between balance records and changes.
   *
   * @param params The balance change parameters
   * @returns The created balance change record
   */
  async createBalanceChange(params: CreateBalanceChangeParams): Promise<BalanceChangeModel> {
    return this.balanceChangeRepository.createBalanceChange(params)
  }

  /**
   * Calculates the current balance for a given address at a specific block
   *
   * Combines the base balance record with all outstanding balance changes
   * since that record's block number. This provides an accurate current balance
   * without requiring constant RPC updates.
   *
   * @param chainId The blockchain chain identifier
   * @param address The wallet/contract address to query
   * @param blockNumber Optional specific block number (defaults to latest)
   * @returns Object containing balance as bigint and block number, or null if no record exists
   */
  async getCurrentBalance(
    chainId: string,
    address: string,
    blockNumber?: string,
  ): Promise<GetCurrentBalanceResult | null> {
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
   * Retrieves a balance record by chain ID and address
   *
   * @param chainId The blockchain chain identifier
   * @param address The wallet/contract address
   * @returns The balance record or null if not found
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
   * Retrieves all balance records for a specific blockchain
   *
   * Results are sorted by address for consistent ordering.
   *
   * @param chainId The blockchain chain identifier
   * @returns Array of balance records for the specified chain
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
