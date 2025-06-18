import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { TrackedBalance, TrackedBalanceDocument } from '../schemas/tracked-balance.schema'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

@Injectable()
export class TrackedBalanceRepository {
  private readonly logger = new Logger(TrackedBalanceRepository.name)

  constructor(
    @InjectModel(TrackedBalance.name)
    private readonly trackedBalanceModel: Model<TrackedBalanceDocument>,
  ) {}

  /**
   * Creates or updates a tracked balance
   */
  async upsertBalance(balanceData: {
    chainId: number
    tokenAddress: string
    balance: string
    decimals?: number
    blockNumber?: string
    transactionHash?: string
  }): Promise<TrackedBalance> {
    try {
      const result = await this.trackedBalanceModel.findOneAndUpdate(
        { chainId: balanceData.chainId, tokenAddress: balanceData.tokenAddress },
        {
          ...balanceData,
          lastUpdated: new Date(),
        },
        { upsert: true, new: true },
      )

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Balance upserted',
          properties: {
            chainId: balanceData.chainId,
            tokenAddress: balanceData.tokenAddress,
            balance: balanceData.balance,
          },
        }),
      )

      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error upserting balance',
          properties: {
            chainId: balanceData.chainId,
            tokenAddress: balanceData.tokenAddress,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Gets a specific balance by chainId and tokenAddress
   */
  async getBalance(chainId: number, tokenAddress: string): Promise<TrackedBalance | null> {
    try {
      return await this.trackedBalanceModel.findOne({
        chainId,
        tokenAddress,
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error getting balance',
          properties: {
            chainId,
            tokenAddress,
            error: error.message,
          },
        }),
      )
      return null
    }
  }

  /**
   * Gets all balances for a specific chain
   */
  async getBalancesForChain(chainId: number): Promise<TrackedBalance[]> {
    try {
      return await this.trackedBalanceModel.find({ chainId }).sort({ tokenAddress: 1 })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error getting balances for chain',
          properties: {
            chainId,
            error: error.message,
          },
        }),
      )
      return []
    }
  }

  /**
   * Gets all tracked balances across all chains
   */
  async getAllBalances(): Promise<TrackedBalance[]> {
    try {
      return await this.trackedBalanceModel.find().sort({ chainId: 1, tokenAddress: 1 })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error getting all balances',
          properties: {
            error: error.message,
          },
        }),
      )
      return []
    }
  }

  /**
   * Updates a balance by applying a change amount
   */
  async updateBalanceByAmount(
    chainId: number,
    tokenAddress: string,
    changeAmount: bigint,
    transactionHash?: string,
    blockNumber?: string,
  ): Promise<TrackedBalance | null> {
    try {
      // Get current balance
      const currentBalance = await this.getBalance(chainId, tokenAddress)
      if (!currentBalance) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'TrackedBalanceRepository: Attempted to update non-existent balance',
            properties: {
              chainId,
              tokenAddress,
              changeAmount: changeAmount.toString(),
            },
          }),
        )
        return null
      }

      const currentBalanceBigInt = BigInt(currentBalance.balance)
      const newBalance = currentBalanceBigInt + changeAmount

      // Prevent negative balances
      if (newBalance < 0n) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'TrackedBalanceRepository: Attempted to create negative balance',
            properties: {
              chainId,
              tokenAddress,
              currentBalance: currentBalance.balance,
              changeAmount: changeAmount.toString(),
              wouldBeBalance: newBalance.toString(),
            },
          }),
        )
        return currentBalance
      }

      // Update the balance
      const updateData: any = {
        balance: newBalance.toString(),
        lastUpdated: new Date(),
      }

      if (transactionHash) {
        updateData.transactionHash = transactionHash
      }

      if (blockNumber) {
        updateData.blockNumber = blockNumber
      }

      const result = await this.trackedBalanceModel.findOneAndUpdate(
        { chainId, tokenAddress },
        updateData,
        { new: true },
      )

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Balance updated by amount',
          properties: {
            chainId,
            tokenAddress,
            previousBalance: currentBalance.balance,
            changeAmount: changeAmount.toString(),
            newBalance: newBalance.toString(),
            transactionHash,
          },
        }),
      )

      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error updating balance by amount',
          properties: {
            chainId,
            tokenAddress,
            changeAmount: changeAmount.toString(),
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Removes all tracked balances (for reset operations)
   */
  async removeAllBalances(): Promise<void> {
    try {
      const result = await this.trackedBalanceModel.deleteMany({})
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: All balances removed',
          properties: {
            deletedCount: result.deletedCount,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error removing all balances',
          properties: {
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Gets balance count statistics
   */
  async getBalanceStats(): Promise<{ totalBalances: number; chainCounts: Record<number, number> }> {
    try {
      const totalBalances = await this.trackedBalanceModel.countDocuments()
      const chainCounts = await this.trackedBalanceModel.aggregate([
        { $group: { _id: '$chainId', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])

      const chainCountsMap = chainCounts.reduce(
        (acc, item) => {
          acc[item._id] = item.count
          return acc
        },
        {} as Record<number, number>,
      )

      return {
        totalBalances,
        chainCounts: chainCountsMap,
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'TrackedBalanceRepository: Error getting balance stats',
          properties: {
            error: error.message,
          },
        }),
      )
      return { totalBalances: 0, chainCounts: {} }
    }
  }
}
