import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { RpcBalanceService, TokenFetchAnalysis } from './rpc-balance.service'
import { BalanceRecordRepository } from '../repositories/balance-record.repository'
import { QUEUES } from '@/common/redis/constants'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import {
  BALANCE_MONITOR_JOBS,
  BALANCE_TRACKER_JOB_OPTIONS,
} from '@/balance-monitor/jobs/balance-monitor.job'
import { BalanceFilter, TokenBalance } from '../types/balance.types'
import { groupBy } from 'lodash'

export interface CachedBalance {
  chainId: number
  tokenAddress: string
  balance: bigint
  lastUpdated: Date
  blockNumber?: bigint
  decimals?: number
}

/**
 * Balance service that provides methods to interact with current balance data.
 * Uses RPC balance service to initialize scheduled BullMQ jobs and provides
 * methods to fetch current balances from the database.
 */
@Injectable()
export class BalanceService implements OnModuleInit {
  private readonly logger = new Logger(BalanceService.name)
  private readonly NATIVE_TOKEN_KEY = 'native'

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) private readonly balanceQueue: Queue,
    private readonly rpcBalanceService: RpcBalanceService,
    private readonly balanceRecordRepository: BalanceRecordRepository,
  ) {}

  async onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'BalanceService: Initializing balance tracking service',
      }),
    )

    // Schedule initialization job with time-based deduplication (every 5 minutes)
    await this.scheduleInitialization()
  }

  /**
   * Schedules the initialization job using time-based deduplication
   * Only allows initialization once per time period (5 minutes)
   */
  private async scheduleInitialization(): Promise<void> {
    try {
      const config = BALANCE_TRACKER_JOB_OPTIONS[BALANCE_MONITOR_JOBS.initialize_monitoring]
      // Create time-based jobId that changes every 5 minutes
      // This allows initialization to run periodically while preventing race conditions
      const timeWindow = 5 * 60 * 1000 // 5 minutes in milliseconds
      const timeSlot = Math.floor(Date.now() / timeWindow)
      const timeBasedJobId = `balance_service_init_${timeSlot}`

      await this.balanceQueue.add(
        BALANCE_MONITOR_JOBS.initialize_monitoring,
        {},
        {
          ...config,
          jobId: timeBasedJobId, // Time-based jobId ensures periodic updates
        },
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Initialization job scheduled',
          properties: {
            jobId: timeBasedJobId,
            timeSlot,
            windowMinutes: 5,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error scheduling initialization',
          properties: {
            error: error.message,
          },
        }),
      )
    }
  }

  /**
   * Gets the current balance for a specific chain and token from the database
   * @param chainId - The chain ID
   * @param tokenAddress - The token address ('native' for native tokens)
   * @returns The current balance or null if not found
   */
  async getCurrentBalance(chainId: number, tokenAddress: string): Promise<bigint | null> {
    try {
      const latestRecord = await this.balanceRecordRepository.findLatestBalance(
        BigInt(chainId),
        tokenAddress as Hex | 'native',
      )

      return latestRecord ? BigInt(latestRecord.balance) : null
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting current balance',
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
   * Gets the current native balance for a specific chain
   * @param chainId - The chain ID
   * @returns The current native balance or null if not found
   */
  async getCurrentNativeBalance(chainId: number): Promise<bigint | null> {
    return this.getCurrentBalance(chainId, this.NATIVE_TOKEN_KEY)
  }

  /**
   * Gets the current token balance for a specific chain and token
   * @param chainId - The chain ID
   * @param tokenAddress - The token address
   * @returns The current token balance or null if not found
   */
  async getCurrentTokenBalance(chainId: number, tokenAddress: Hex): Promise<bigint | null> {
    return this.getCurrentBalance(chainId, tokenAddress)
  }

  /**
   * Gets the latest balance record with full details for a specific chain and token
   * @param chainId - The chain ID
   * @param tokenAddress - The token address ('native' for native tokens)
   * @returns The latest balance record or null if not found
   */
  async getLatestBalanceRecord(chainId: number, tokenAddress: string) {
    try {
      return await this.balanceRecordRepository.findLatestBalance(
        BigInt(chainId),
        tokenAddress as Hex | 'native',
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting latest balance record',
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
   * Gets all current balances for a specific chain
   * @param chainId - The chain ID
   * @returns Array of cached balance objects
   */
  async getAllBalancesForChain(chainId: number): Promise<CachedBalance[]> {
    try {
      // Get all unique token addresses for this chain
      const filters: BalanceFilter = {
        chainId: BigInt(chainId),
      }

      const records = await this.balanceRecordRepository.findByFilters(filters)

      // Group by token address and get the latest record for each
      const tokenGroups = new Map<string, any>()

      for (const record of records) {
        const tokenKey = record.tokenAddress
        if (
          !tokenGroups.has(tokenKey) ||
          BigInt(record.blockNumber) > BigInt(tokenGroups.get(tokenKey).blockNumber)
        ) {
          tokenGroups.set(tokenKey, record)
        }
      }

      // Convert to CachedBalance format
      return Array.from(tokenGroups.values()).map((record) => ({
        chainId,
        tokenAddress: record.tokenAddress,
        balance: BigInt(record.balance),
        lastUpdated: record.timestamp,
        blockNumber: BigInt(record.blockNumber),
        decimals: record.decimals,
      }))
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
   * Gets balance history for a specific chain and token
   * @param chainId - The chain ID
   * @param tokenAddress - The token address ('native' for native tokens)
   * @param limit - Maximum number of records to return (default: 100)
   * @returns Array of balance records ordered by block number (latest first)
   */
  async getBalanceHistory(chainId: number, tokenAddress: string, limit = 100) {
    try {
      return await this.balanceRecordRepository.getBalanceHistory(
        BigInt(chainId),
        tokenAddress as Hex | 'native',
        limit,
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting balance history',
          properties: {
            chainId,
            tokenAddress,
            limit,
            error: error.message,
          },
        }),
      )
      return []
    }
  }

  /**
   * Gets balance statistics for a specific chain and token
   * @param chainId - The chain ID
   * @param tokenAddress - The token address ('native' for native tokens)
   * @param fromDate - Start date for statistics calculation (optional)
   * @param toDate - End date for statistics calculation (optional)
   * @returns Balance statistics or null if no data found
   */
  async getBalanceStats(chainId: number, tokenAddress: string, fromDate?: Date, toDate?: Date) {
    try {
      return await this.balanceRecordRepository.getBalanceStats(
        BigInt(chainId),
        tokenAddress as Hex | 'native',
        fromDate,
        toDate,
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting balance stats',
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
   * Fetches token data for a specific chain using database records instead of network calls
   * Returns the same format as RpcBalanceService.fetchTokenData but from cached database data
   * @param chainId - The chain ID
   * @returns Array of TokenFetchAnalysis objects with config, token balance, and chainId
   */
  async fetchTokenData(chainId: number): Promise<TokenFetchAnalysis[]> {
    try {
      // Get token configs for this chain from RPC service
      const tokenConfigs =
        groupBy(this.rpcBalanceService.getInboxTokens(), 'chainId')[chainId] || []

      if (tokenConfigs.length === 0) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: 'BalanceService: No token configs found for chain',
            properties: { chainId },
          }),
        )
        return []
      }

      // Extract token addresses from configs
      const tokenAddresses = tokenConfigs.map((config) => config.address)

      // Use single database query to get all balance records for this chain
      const filters: BalanceFilter = {
        chainId: BigInt(chainId),
      }

      const allRecords = await this.balanceRecordRepository.findByFilters(filters)

      // Filter records to only include the tokens we're interested in and get latest for each
      const tokenBalanceMap = new Map<string, any>()

      for (const record of allRecords) {
        const tokenAddress = record.tokenAddress

        // Only include records for tokens in our config
        if (tokenAddresses.includes(tokenAddress as Hex)) {
          const existing = tokenBalanceMap.get(tokenAddress)
          if (!existing || BigInt(record.blockNumber) > BigInt(existing.blockNumber)) {
            tokenBalanceMap.set(tokenAddress, record)
          }
        }
      }

      // Build TokenFetchAnalysis results by matching configs with balance records
      const results: TokenFetchAnalysis[] = []

      for (const config of tokenConfigs) {
        const balanceRecord = tokenBalanceMap.get(config.address)

        if (balanceRecord) {
          // Create TokenBalance object from database record
          const tokenBalance: TokenBalance = {
            address: config.address,
            balance: BigInt(balanceRecord.balance),
            decimals: balanceRecord.decimals || 6, // Default to 6 decimals as per RPC service validation
          }

          results.push({
            config,
            token: tokenBalance,
            chainId,
          })
        } else {
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'BalanceService: No balance record found for token',
              properties: {
                chainId,
                tokenAddress: config.address,
              },
            }),
          )
        }
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Token data fetched from database',
          properties: {
            chainId,
            totalTokens: tokenConfigs.length,
            validResults: results.length,
          },
        }),
      )

      return results
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error fetching token data',
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
   * Gets the latest balance records by block number for each unique token address on a given chain
   * Uses MongoDB aggregation pipeline for efficient querying
   * @param chainId - The chain ID
   * @returns Array of balance records with the highest block number for each unique token address
   */
  async getLatestBalanceRecordsByChain(chainId: number) {
    try {
      const records = await this.balanceRecordRepository.findLatestBalanceRecordsByChain(
        BigInt(chainId),
      )

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Latest balance records fetched by chain',
          properties: {
            chainId,
            recordCount: records.length,
          },
        }),
      )

      return records
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting latest balance records by chain',
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
   * Forces a refresh of balance data by scheduling an immediate initialization job
   * @returns Promise that resolves when the job is scheduled
   */
  async refreshBalances(): Promise<void> {
    try {
      const config = BALANCE_TRACKER_JOB_OPTIONS[BALANCE_MONITOR_JOBS.initialize_monitoring]
      const immediateJobId = `balance_service_refresh_${Date.now()}`

      await this.balanceQueue.add(
        BALANCE_MONITOR_JOBS.initialize_monitoring,
        { force: true },
        {
          ...config,
          jobId: immediateJobId,
          priority: config.priority + 5, // Higher priority for manual refresh
        },
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Balance refresh job scheduled',
          properties: {
            jobId: immediateJobId,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error scheduling balance refresh',
          properties: {
            error: error.message,
          },
        }),
      )
      throw error
    }
  }
}
