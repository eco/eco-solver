import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceQuote } from '@/liquidity-manager/types/types'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { v4 as uuid } from 'uuid'

/**
 * Interface for creating a new successful rebalance record.
 * Contains all the required data to persist a completed rebalance operation.
 */
export interface CreateRebalanceData {
  /** Wallet address that initiated the rebalance */
  wallet?: string
  /** Source token information */
  tokenIn: RebalanceTokenModel
  /** Destination token information */
  tokenOut: RebalanceTokenModel
  /** Amount input to the rebalance */
  amountIn: bigint
  /** Amount received from the rebalance */
  amountOut: bigint
  /** Slippage percentage used */
  slippage: number
  /** Strategy used for the rebalance */
  strategy: string
  /** Group ID for batch operations */
  groupId?: string
  /** Strategy-specific context data */
  context: any
}

/**
 * Repository for managing successful rebalance operations in MongoDB.
 *
 * This repository handles the persistence of completed rebalance operations
 * and provides health monitoring capabilities. It replaces direct model
 * usage in LiquidityManagerService with proper repository abstraction.
 *
 * Key features:
 * - Single and batch rebalance persistence
 * - Health monitoring for successful operations
 * - Comprehensive error handling and logging
 * - Support for grouped rebalancing operations
 */
@Injectable()
export class RebalanceRepository {
  private logger = new Logger(RebalanceRepository.name)

  constructor(
    @InjectModel(RebalanceModel.name)
    private model: Model<RebalanceModel>,
  ) {}

  /**
   * Persists a successful rebalance operation to the database.
   *
   * This method logs the operation and handles any persistence errors
   * gracefully to ensure reliability of the rebalancing system.
   *
   * @param rebalanceData - Complete rebalance information
   * @returns EcoResponse with created model or error details
   */
  async create(rebalanceData: CreateRebalanceData): Promise<EcoResponse<RebalanceModel>> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Persisting successful rebalance',
          properties: {
            strategy: rebalanceData.strategy,
            wallet: rebalanceData.wallet,
            tokenInChain: rebalanceData.tokenIn.chainId,
            tokenOutChain: rebalanceData.tokenOut.chainId,
            groupId: rebalanceData.groupId,
          },
        }),
      )

      const rebalanceModel = await this.model.create(rebalanceData)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Successful rebalance persisted',
          properties: {
            rebalanceId: rebalanceModel._id,
            strategy: rebalanceData.strategy,
            groupId: rebalanceData.groupId,
          },
        }),
      )

      return { response: rebalanceModel }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to persist successful rebalance',
          properties: {
            rebalanceData,
            error: error.message,
          },
        }),
      )

      return { error }
    }
  }

  /**
   * Creates multiple rebalance records as a batch operation.
   *
   * This method replaces the logic previously in LiquidityManagerService.storeRebalancing.
   * It generates a group ID for related rebalances and attempts to persist all quotes.
   * If any individual rebalance fails, the entire batch is considered failed.
   *
   * @param walletAddress - Wallet that initiated the rebalances
   * @param quotes - Array of rebalance quotes to persist
   * @param groupId - Optional group ID (will generate if not provided)
   * @returns EcoResponse with array of created models or error details
   */
  async createBatch(
    walletAddress: string,
    quotes: RebalanceQuote[],
    groupId?: string,
  ): Promise<EcoResponse<RebalanceModel[]>> {
    const batchGroupId = groupId || uuid()
    const results: RebalanceModel[] = []
    const errors: any[] = []

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Creating batch rebalances',
        properties: {
          wallet: walletAddress,
          groupId: batchGroupId,
          quotesCount: quotes.length,
        },
      }),
    )

    for (const quote of quotes) {
      const rebalanceData: CreateRebalanceData = {
        groupId: batchGroupId,
        wallet: walletAddress,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        slippage: quote.slippage,
        strategy: quote.strategy,
        context: quote.context,
        tokenIn: RebalanceTokenModel.fromTokenData(quote.tokenIn),
        tokenOut: RebalanceTokenModel.fromTokenData(quote.tokenOut),
      }

      const result = await this.create(rebalanceData)
      if (result.response) {
        results.push(result.response)
      } else if (result.error) {
        errors.push(result.error)
      }
    }

    if (errors.length > 0) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Some rebalances failed to persist in batch',
          properties: {
            wallet: walletAddress,
            groupId: batchGroupId,
            successCount: results.length,
            errorCount: errors.length,
          },
        }),
      )

      return {
        error: new Error(`${errors.length} out of ${quotes.length} rebalances failed to persist`),
      }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Batch rebalances created successfully',
        properties: {
          wallet: walletAddress,
          groupId: batchGroupId,
          count: results.length,
        },
      }),
    )

    return { response: results }
  }

  /**
   * Checks if any successful rebalances occurred in the last hour.
   *
   * This method is used by the health monitoring system to determine
   * if the rebalancing system is actively processing successful operations.
   *
   * @returns Promise<boolean> - true if successful rebalances exist, false otherwise
   */
  async hasSuccessfulRebalancesInLastHour(): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const count = await this.model.countDocuments({
        createdAt: { $gte: oneHourAgo },
      })
      return count > 0
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to check successful rebalances in last hour',
          properties: { error: error.message },
        }),
      )
      return false
    }
  }

  /**
   * Gets the count of successful rebalances within a specified time range.
   *
   * This method supports flexible time-based analytics and health monitoring.
   * Used for calculating success/failure ratios and performance metrics.
   *
   * @param timeRangeMinutes - Time window in minutes (default: 60)
   * @returns Promise<number> - Count of successful rebalances in the time range
   */
  async getRecentSuccessCount(timeRangeMinutes: number = 60): Promise<number> {
    try {
      const timeAgo = new Date(Date.now() - timeRangeMinutes * 60 * 1000)
      return await this.model.countDocuments({
        createdAt: { $gte: timeAgo },
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to get recent success count',
          properties: { timeRangeMinutes, error: error.message },
        }),
      )
      return 0
    }
  }
}
