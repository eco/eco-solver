import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Hex } from 'viem'
import { WithdrawalModel } from '@/intent/schemas/withdrawal.schema'
import { WatchEventModel } from '@/intent/schemas/watch-event.schema'
import { WithdrawalLog, WithdrawalEventLog, decodeWithdrawalLog } from '@/contracts/intent-source'
import { Network } from '@/common/alchemy/network'
import { CreateModelParamsWithExclusions } from '@/common/db/utils'

export type CreateWithdrawalParams = CreateModelParamsWithExclusions<WithdrawalModel, 'processedAt'>

export interface WithdrawalFilters {
  recipient?: Hex
  intentHash?: Hex
  intentId?: Types.ObjectId
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
   * Check if withdrawal already exists by intent hash
   */
  async exists(intentHash: Hex): Promise<boolean> {
    const res = await this.withdrawalModel.exists({ intentHash })
    return Boolean(res)
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

    return query
  }

  /**
   * Creates a WatchEventModel from a WithdrawalLog
   * @param withdrawalLog - The withdrawal log from the blockchain
   * @returns WatchEventModel with blockchain event data
   */
  static createWatchEvent(withdrawalLog: WithdrawalLog): WatchEventModel {
    return {
      sourceChainID:
        typeof withdrawalLog.sourceChainID === 'object'
          ? BigInt((withdrawalLog.sourceChainID as any).hex)
          : BigInt(withdrawalLog.sourceChainID),
      sourceNetwork: withdrawalLog.sourceNetwork as Network,
      blockNumber:
        typeof withdrawalLog.blockNumber === 'object'
          ? BigInt((withdrawalLog.blockNumber as any).hex)
          : BigInt(withdrawalLog.blockNumber),
      blockHash: withdrawalLog.blockHash,
      transactionIndex: withdrawalLog.transactionIndex,
      removed: withdrawalLog.removed,
      address: withdrawalLog.address,
      data: withdrawalLog.data,
      topics: withdrawalLog.topics,
      transactionHash: withdrawalLog.transactionHash,
      logIndex: withdrawalLog.logIndex,
    }
  }

  /**
   * Creates withdrawal parameters for database insertion from a withdrawal log
   * @param withdrawalLog - The withdrawal log from the blockchain
   * @param intentId - The MongoDB ObjectId of the related intent
   * @returns CreateWithdrawalParams for repository creation
   */
  static createWithdrawalParams(
    withdrawalLog: WithdrawalLog,
    intentId: Types.ObjectId,
  ): CreateWithdrawalParams {
    // Check if the log already has decoded args (e.g., in tests)
    let args: any
    if ((withdrawalLog as any).args) {
      args = (withdrawalLog as any).args
    } else {
      const decodedEvent = decodeWithdrawalLog(withdrawalLog.data, withdrawalLog.topics)
      args = decodedEvent.args
    }

    if (!args?.hash || !args?.recipient) {
      throw new Error('Withdrawal event missing required arguments (hash or recipient)')
    }

    return {
      event: this.createWatchEvent(withdrawalLog),
      intentHash: args.hash as Hex,
      intentId,
      recipient: args.recipient as Hex,
    }
  }

  /**
   * Decodes a withdrawal log and extracts the event arguments
   * @param withdrawalLog - The withdrawal log from the blockchain
   * @returns The decoded withdrawal event
   */
  static decodeWithdrawal(withdrawalLog: WithdrawalLog): WithdrawalEventLog {
    return decodeWithdrawalLog(withdrawalLog.data, withdrawalLog.topics)
  }

  /**
   * Extracts the intent hash from a withdrawal log
   * @param withdrawalLog - The withdrawal log from the blockchain
   * @returns The intent hash or null if not found
   */
  static extractIntentHash(withdrawalLog: WithdrawalLog): Hex | null {
    try {
      // Check if the log already has decoded args (e.g., in tests)
      if ((withdrawalLog as any).args) {
        return ((withdrawalLog as any).args.hash as Hex) || null
      }
      const decodedEvent = this.decodeWithdrawal(withdrawalLog)
      return (decodedEvent.args?.hash as Hex) || null
    } catch {
      return null
    }
  }

  /**
   * Extracts the recipient address from a withdrawal log
   * @param withdrawalLog - The withdrawal log from the blockchain
   * @returns The recipient address or null if not found
   */
  static extractRecipient(withdrawalLog: WithdrawalLog): Hex | null {
    try {
      // Check if the log already has decoded args (e.g., in tests)
      if ((withdrawalLog as any).args) {
        return ((withdrawalLog as any).args.recipient as Hex) || null
      }
      const decodedEvent = this.decodeWithdrawal(withdrawalLog)
      return (decodedEvent.args?.recipient as Hex) || null
    } catch {
      return null
    }
  }
}
