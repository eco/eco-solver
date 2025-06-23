import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { RpcBalanceService } from './rpc-balance.service'
import { BalanceRecordRepository } from '../repositories/balance-record.repository'
import { BalanceChangeRepository } from '../repositories/balance-change.repository'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import {
  BALANCE_JOBS,
  BALANCE_JOB_OPTIONS,
  UpdateBalanceRecordJobData,
} from '@/balance/jobs/balance.job'

/**
 * Simple balance service that provides methods to interact with balance data
 * - BalanceRecords are updated only from RPC calls with greater block numbers
 * - BalanceChanges are created from watch services
 * - getCurrentBalance calculates balance record + changes + rewards for a specific block
 */
@Injectable()
export class BalanceService implements OnModuleInit {
  private readonly logger = new Logger(BalanceService.name)

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) private readonly balanceQueue: Queue,
    private readonly rpcService: RpcBalanceService,
    private readonly balanceRecordRepository: BalanceRecordRepository,
    private readonly balanceChangeRepository: BalanceChangeRepository,
    private readonly intentSourceRepository: IntentSourceRepository,
    private readonly configService: EcoConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'BalanceService: Initializing balance tracking service',
      }),
    )

    await this.scheduleInitialization()
  }

  private async scheduleInitialization(): Promise<void> {
    try {
      //create a time slot so we only get one job in a multi pod env
      const config = BALANCE_JOB_OPTIONS[BALANCE_JOBS.init_balance_record]
      const updateInterval = this.getUpdateInterval()
      const timeSlot = Math.floor(Date.now() / updateInterval)

      // Prepare job data for balance record updates
      const jobData: UpdateBalanceRecordJobData = {
        forceRefresh: true,
        triggeredAt: new Date(),
      }

      // Run immediately first
      const immediateJobId = `balance_service_init_immediate_${timeSlot}`
      await this.balanceQueue.add(BALANCE_JOBS.init_balance_record, jobData, {
        ...config,
        jobId: immediateJobId,
      })

      // Schedule recurring job using configured interval
      const recurringJobId = 'balance_service_init_recurring'
      await this.balanceQueue.add(
        BALANCE_JOBS.init_balance_record,
        { ...jobData, triggeredAt: undefined }, // Don't set triggeredAt for recurring jobs
        {
          ...config,
          jobId: recurringJobId,
          repeat: {
            every: updateInterval,
          },
        },
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Initialization jobs scheduled',
          properties: {
            immediateJobId,
            recurringJobId,
            intervalMs: updateInterval,
            intervalMinutes: Math.round(updateInterval / (60 * 1000)),
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error scheduling initialization',
          properties: { error: error.message },
        }),
      )
    }
  }

  private getUpdateInterval(): number {
    const intervals = this.configService.getIntervals() as any
    return intervals.balanceRpcUpdate.repeatOpts.every
  }

  /**
   * Get current balance for chainId/address/block including rewards from SOLVED intents
   * Defaults to latest block if no block specified
   */
  async getCurrentBalance(
    chainId: number,
    address: string,
    blockNumber?: string,
  ): Promise<{ balance: bigint; blockNumber: string } | null> {
    try {
      const result = await this.balanceRecordRepository.getCurrentBalance(
        chainId.toString(),
        address,
        blockNumber,
      )

      if (!result) {
        return null
      }

      // Get rewards from SOLVED intents for this chain and address
      let rewardAmount = BigInt(0)
      try {
        const tokenAddress = address === 'native' ? undefined : (address as Hex)
        rewardAmount = await this.intentSourceRepository.calculateTotalRewardsForChainAndToken(
          BigInt(chainId),
          tokenAddress,
        )
      } catch (rewardError) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'BalanceService: Error calculating rewards, continuing without rewards',
            properties: {
              chainId,
              address,
              error: rewardError.message,
            },
          }),
        )
      }

      // Add rewards to the balance
      const totalBalance = result.balance + rewardAmount

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Current balance with rewards retrieved',
          properties: {
            chainId,
            address,
            blockNumber: result.blockNumber,
            balanceFromRecords: result.balance.toString(),
            rewardAmount: rewardAmount.toString(),
            totalBalance: totalBalance.toString(),
          },
        }),
      )

      return {
        balance: totalBalance,
        blockNumber: result.blockNumber,
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting current balance',
          properties: {
            chainId,
            address,
            blockNumber,
            error: error.message,
          },
        }),
      )
      return null
    }
  }

  /**
   * Get current native balance
   */
  async getCurrentNativeBalance(
    chainId: number,
    blockNumber?: string,
  ): Promise<{ balance: bigint; blockNumber: string } | null> {
    return this.getCurrentBalance(chainId, 'native', blockNumber)
  }

  /**
   * Get current token balance
   */
  async getCurrentTokenBalance(
    chainId: number,
    tokenAddress: Hex,
    blockNumber?: string,
  ): Promise<{ balance: bigint; blockNumber: string } | null> {
    return this.getCurrentBalance(chainId, tokenAddress, blockNumber)
  }

  /**
   * Create balance change from watch services (only called by job processors)
   */
  async createBalanceChange(params: {
    chainId: number
    address: string
    changeAmount: string
    direction: 'incoming' | 'outgoing'
    blockNumber: string
    blockHash: string
    transactionHash: string
    timestamp: Date
    from?: string
    to?: string
  }) {
    try {
      const result = await this.balanceChangeRepository.createBalanceChange({
        chainId: params.chainId.toString(),
        address: params.address,
        changeAmount: params.changeAmount,
        direction: params.direction,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        transactionHash: params.transactionHash,
        timestamp: params.timestamp,
        from: params.from,
        to: params.to,
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Balance change created',
          properties: {
            chainId: params.chainId,
            address: params.address,
            direction: params.direction,
            changeAmount: params.changeAmount,
            transactionHash: params.transactionHash,
          },
        }),
      )

      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error creating balance change',
          properties: {
            chainId: params.chainId,
            address: params.address,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Get all balance records for a chain
   */
  async getAllBalancesForChain(chainId: number) {
    try {
      return await this.balanceRecordRepository.findByChain(chainId.toString())
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting all balances for chain',
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
   * Update balance records from RPC data - called by balance tracker processor
   * Fetches current token balances and native balances from blockchain RPC
   */
  async updateBalanceRecordsFromRpc(): Promise<void> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Starting RPC balance record update',
        }),
      )

      // Get all token data from RPC
      const tokenDataResults = await this.rpcService.getAllTokenData(true) // Force refresh
      let tokenUpdates = 0

      // Update token balance records
      for (const tokenData of tokenDataResults) {
        try {
          await this.updateBalanceFromRpc({
            chainId: tokenData.chainId,
            address: tokenData.balance.address,
            balance: tokenData.balance.balance.toString(),
            blockNumber: tokenData.balance.blockNumber.toString(),
            blockHash: tokenData.balance.blockHash,
            timestamp: new Date(),
            decimals: tokenData.balance.decimals,
            tokenSymbol: tokenData.config.type, // Available from config
            tokenName: tokenData.config.type, // Available from config
          })
          tokenUpdates++
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: 'BalanceService: Error updating token balance record',
              properties: {
                chainId: tokenData.chainId,
                tokenAddress: tokenData.balance.address,
                error: error.message,
              },
            }),
          )
        }
      }

      // Get all native balances from RPC
      const nativeBalanceResults = await this.rpcService.fetchAllNativeBalances(true) // Force refresh
      let nativeUpdates = 0

      // Update native balance records
      for (const nativeBalance of nativeBalanceResults) {
        if (!nativeBalance) continue // Skip failed fetches

        try {
          await this.updateBalanceFromRpc({
            chainId: nativeBalance.chainId,
            address: 'native',
            balance: nativeBalance.balance.toString(),
            blockNumber: nativeBalance.blockNumber.toString(),
            blockHash: nativeBalance.blockHash,
            timestamp: new Date(),
          })
          nativeUpdates++
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: 'BalanceService: Error updating native balance record',
              properties: {
                chainId: nativeBalance.chainId,
                error: error.message,
              },
            }),
          )
        }
      }

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: RPC balance record update completed',
          properties: {
            tokenUpdates,
            nativeUpdates,
            totalUpdates: tokenUpdates + nativeUpdates,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error during RPC balance record update',
          properties: {
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Update balance record from RPC call (only called by job processors)
   */
  async updateBalanceFromRpc(params: {
    chainId: number
    address: string
    balance: string
    blockNumber: string
    blockHash: string
    timestamp: Date
    decimals?: number
    tokenSymbol?: string
    tokenName?: string
  }) {
    try {
      const result = await this.balanceRecordRepository.updateFromRpc({
        chainId: params.chainId.toString(),
        address: params.address,
        balance: params.balance,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        timestamp: params.timestamp,
        decimals: params.decimals,
        tokenSymbol: params.tokenSymbol,
        tokenName: params.tokenName,
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Balance updated from RPC',
          properties: {
            chainId: params.chainId,
            address: params.address,
            balance: params.balance,
            blockNumber: params.blockNumber,
          },
        }),
      )

      return result
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error updating balance from RPC',
          properties: {
            chainId: params.chainId,
            address: params.address,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }
}
