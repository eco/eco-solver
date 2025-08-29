import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  RebalanceQuoteRejectionModel,
  RejectionReason,
} from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
import { Strategy } from '@/liquidity-manager/types/types'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { getOneHourAgo, getTimeAgo } from '@/common/utils/time'

/**
 * Interface for creating a new quote rejection record.
 * Contains all the required data to persist a rejected rebalance quote.
 */
export interface CreateRejectionData {
  /** Unique identifier for the rebalance operation */
  rebalanceId: string
  /** Strategy that generated the rejected quote */
  strategy: Strategy
  /** Categorized reason for the rejection */
  reason: RejectionReason
  /** Source token information */
  tokenIn: RebalanceTokenModel
  /** Destination token information */
  tokenOut: RebalanceTokenModel
  /** Amount being swapped */
  swapAmount: number
  /** Additional context about the rejection (error details, slippage info, etc.) */
  details?: any
  /** Optional wallet address associated with the rejection */
  walletAddress?: string
}

/**
 * Repository for managing rejected rebalance quotes in MongoDB.
 *
 * This repository provides data persistence and health monitoring capabilities
 * for quote rejections. It follows a non-blocking design where persistence
 * failures are logged but don't break the main quote flow.
 *
 * Key features:
 * - Persist rejection data with detailed context
 * - Health monitoring methods for system status
 * - Comprehensive error handling and logging
 * - Time-based queries for analytics
 */
@Injectable()
export class RebalanceQuoteRejectionRepository {
  private logger = new Logger(RebalanceQuoteRejectionRepository.name)

  constructor(
    @InjectModel(RebalanceQuoteRejectionModel.name)
    private model: Model<RebalanceQuoteRejectionModel>,
  ) {}

  /**
   * Persists a rejected quote to the database.
   *
   * This method is designed to be non-blocking - if persistence fails,
   * it logs the error but doesn't throw to avoid breaking quote operations.
   *
   * @param rejectionData - Complete rejection information including context
   * @returns EcoResponse with created model or error details
   */
  async create(
    rejectionData: CreateRejectionData,
  ): Promise<EcoResponse<RebalanceQuoteRejectionModel>> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Persisting quote rejection',
          properties: {
            rebalanceId: rejectionData.rebalanceId,
            strategy: rejectionData.strategy,
            reason: rejectionData.reason,
            tokenInChain: rejectionData.tokenIn.chainId,
            tokenOutChain: rejectionData.tokenOut.chainId,
          },
        }),
      )

      const rejectionModel = await this.model.create(rejectionData)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Quote rejection persisted successfully',
          properties: {
            rejectionId: rejectionModel._id,
            rebalanceId: rejectionData.rebalanceId,
          },
        }),
      )

      return { response: rejectionModel }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to persist quote rejection',
          properties: {
            rejectionData,
            error: error.message,
          },
        }),
      )

      return { error }
    }
  }

  /**
   * Checks if any rejections occurred in the last hour.
   *
   * This method is used by the health monitoring system to determine
   * if the rebalancing system has encountered recent failures.
   *
   * @returns Promise<boolean> - true if rejections exist, false otherwise
   */
  async hasRejectionsInLastHour(): Promise<boolean> {
    try {
      const oneHourAgo = getOneHourAgo()
      const count = await this.model.countDocuments({
        createdAt: { $gte: oneHourAgo },
      })
      return count > 0
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to check rejections in last hour',
          properties: { error: error.message },
        }),
      )
      return false
    }
  }

  /**
   * Gets the count of rejections within a specified time range.
   *
   * This method supports flexible time-based analytics and health monitoring.
   * Used for calculating success/failure ratios and trend analysis.
   *
   * @param timeRangeMinutes - Time window in minutes (default: 60)
   * @returns Promise<number> - Count of rejections in the time range
   */
  async getRecentRejectionCount(timeRangeMinutes: number = 60): Promise<number> {
    try {
      const timeAgo = getTimeAgo(timeRangeMinutes)
      return await this.model.countDocuments({
        createdAt: { $gte: timeAgo },
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to get recent rejection count',
          properties: { timeRangeMinutes, error: error.message },
        }),
      )
      return 0
    }
  }
}
