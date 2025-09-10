import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceQuote } from '@/liquidity-manager/types/types'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { v4 as uuid } from 'uuid'
import { getOneHourAgo, getTimeAgo } from '@/common/utils/time'

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
 * Repository for managing rebalance operations in MongoDB.
 *
 * This repository handles the persistence of both completed and pending rebalance operations
 * and provides health monitoring capabilities. It replaces direct model
 * usage in LiquidityManagerService with proper repository abstraction.
 *
 * Key features:
 * - Single and batch rebalance persistence
 * - Health monitoring for successful operations
 * - Comprehensive error handling and logging
 * - Support for grouped rebalancing operations
 * - Status tracking and updates for pending rebalances
 * - Token reservation tracking for pending rebalances
 */
@Injectable()
export class RebalanceRepository {
  private logger = new Logger(RebalanceRepository.name)

  constructor(
    @InjectModel(RebalanceModel.name)
    private model: Model<RebalanceModel>,
  ) {}

  /**
   * Generic query method for rebalances with optional projection
   */
  async queryRebalances(query: object, projection: object = {}): Promise<RebalanceModel[]> {
    return this.model.find(query, projection)
  }

  /**
   * Creates a new rebalance model
   */
  async create(rebalanceModel: RebalanceModel): Promise<RebalanceModel>
  /**
   * Creates a rebalance from structured data
   */
  async create(rebalanceData: CreateRebalanceData): Promise<EcoResponse<RebalanceModel>>
  /**
   * Method overloading implementation - supports both direct model creation and structured data
   */
  async create(
    input: RebalanceModel | CreateRebalanceData,
  ): Promise<RebalanceModel | EcoResponse<RebalanceModel>> {
    // Direct model creation (simple case)
    if (this.isRebalanceModel(input)) {
      return this.model.create(input as RebalanceModel)
    }

    // Structured data creation (comprehensive case)
    const rebalanceData = input as CreateRebalanceData

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
            rebalanceData: rebalanceData,
            error: error.message,
          },
        }),
      )

      return { error }
    }
  }

  /**
   * Type guard to determine if the input is a RebalanceModel
   */
  private isRebalanceModel(data: CreateRebalanceData | RebalanceModel): data is RebalanceModel {
    return 'toObject' in data || !('tokenIn' in data && 'tokenOut' in data)
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
      if ('response' in result && result.response) {
        results.push(result.response)
      } else if ('error' in result && result.error) {
        errors.push(result.error)
      }
    }

    if (errors.length > 0) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to store rebalancing batch',
          properties: {
            wallet: walletAddress,
            groupId: batchGroupId,
            quotesCount: quotes.length,
            successCount: results.length,
            errorCount: errors.length,
            firstError: errors[0]?.message,
          },
        }),
      )

      return {
        error: new Error(`${errors.length} out of ${quotes.length} rebalances failed to persist`),
      }
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Rebalancing batch stored successfully',
        properties: {
          wallet: walletAddress,
          groupId: batchGroupId,
          storedCount: results.length,
        },
      }),
    )

    return { response: results }
  }

  /**
   * Updates the status of a rebalance by job ID
   */
  async updateStatus(
    rebalanceJobID: string,
    status: RebalanceStatus,
  ): Promise<RebalanceModel | null> {
    return this.update({ rebalanceJobID }, { status: status.toString() })
  }

  /**
   * Generic update method for rebalance documents
   */
  async update(query: object, updates: object, options?: object): Promise<RebalanceModel | null> {
    const updateOptions = options || { upsert: false, new: true }
    const updatesData = this.updatesHasOp(updates) ? updates : { $set: updates }

    const updateResponse = await this.model.findOneAndUpdate(query, updatesData, updateOptions)

    if (updateResponse) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = updateResponse.toObject({ versionKey: false })
      return rest as RebalanceModel
    }

    return null
  }

  /**
   * Helper method to check if updates object contains MongoDB operators
   */
  private updatesHasOp(updates: object): boolean {
    return Object.keys(updates).some((key) => key.startsWith('$'))
  }

  /**
   * Insert multiple rebalance models in a single operation
   */
  async insertMany(models: RebalanceModel[]): Promise<any> {
    return this.model.insertMany(models)
  }

  /**
   * Delete multiple rebalance documents matching the query
   */
  async deleteMany(query: object): Promise<any> {
    return this.model.deleteMany(query)
  }

  /**
   * Returns a map of reserved amounts (sum of amountIn) for tokens that are part of
   * pending rebalances for the provided wallet.
   * Key format: `${chainId}:${tokenAddressLowercase}` → bigint amountIn
   */
  async getPendingReservedByTokenForWallet(walletAddress: string): Promise<Map<string, bigint>> {
    return this.getPendingByTokenForWallet(walletAddress, 'amountIn', 'tokenIn')
  }

  /**
   * Returns a map of incoming in-flight amounts (sum of amountOut) for tokens that are part of
   * pending rebalances for the provided wallet.
   * Key format: `${chainId}:${tokenAddressLowercase}` → bigint amountOut
   */
  async getPendingIncomingByTokenForWallet(walletAddress: string): Promise<Map<string, bigint>> {
    return this.getPendingByTokenForWallet(walletAddress, 'amountOut', 'tokenOut')
  }

  private async getPendingByTokenForWallet(
    walletAddress: string,
    amountKey: 'amountIn' | 'amountOut',
    tokenKey: 'tokenIn' | 'tokenOut',
  ): Promise<Map<string, bigint>> {
    const map = new Map<string, bigint>()
    const docs = await this.model
      .find(
        {
          status: RebalanceStatus.PENDING.toString(),
          wallet: walletAddress,
        },
        { [amountKey]: 1, [tokenKey]: 1, wallet: 1, status: 1 },
      )
      .lean()

    for (const doc of docs) {
      const { chainId, tokenAddress } = doc[tokenKey]
      const amount = BigInt(doc[amountKey].toString())

      if (amount <= 0n) {
        continue
      }

      const key = `${chainId}:${String(tokenAddress).toLowerCase()}`
      const previous = map.get(key) ?? 0n
      map.set(key, previous + amount)
    }

    return map
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
      const oneHourAgo = getOneHourAgo()
      const count = await this.model.countDocuments({
        createdAt: { $gte: oneHourAgo },
        status: RebalanceStatus.COMPLETED.toString(),
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
      const timeAgo = getTimeAgo(timeRangeMinutes)
      return await this.model.countDocuments({
        createdAt: { $gte: timeAgo, status: RebalanceStatus.COMPLETED.toString() },
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
