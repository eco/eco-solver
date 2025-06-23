import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { QUEUES } from '@/common/redis/constants'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { TrackedBalanceRepository } from './repositories/tracked-balance.repository'
import { TrackedBalance } from './schemas/tracked-balance.schema'
import { BALANCE_MONITOR_JOBS, BALANCE_TRACKER_JOB_OPTIONS } from './jobs/balance-monitor.job'

export interface BalanceChange {
  chainId: number
  tokenAddress: string
  changeAmount: bigint
  transactionHash?: Hex
  timestamp?: Date
}

/**
 * Balance tracker service using MongoDB for storage and BullMQ only for initialization.
 * Balances are stored in MongoDB for reliable persistence and easy querying.
 */
@Injectable()
export class BalanceTrackerService implements OnModuleInit {
  private readonly logger = new Logger(BalanceTrackerService.name)
  private readonly NATIVE_TOKEN_KEY = 'native'

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) private readonly balanceQueue: Queue,
    private readonly balanceService: RpcBalanceService,
    private readonly trackedBalanceRepository: TrackedBalanceRepository,
  ) {}

  async onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'BalanceTrackerService: Initializing balance tracking',
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
      const timeBasedJobId = `initialize_monitoring_${timeSlot}`

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
          message: 'BalanceTrackerService: Initialization job scheduled',
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
          message: 'BalanceTrackerService: Error scheduling initialization',
          properties: {
            error: error.message,
          },
        }),
      )
    }
  }

  /**
   * Initializes balance tracking by fetching current balances and storing them in MongoDB
   */
  async initializeBalanceTracking(): Promise<void> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message:
            'BalanceTrackerService: Starting balance tracking initialization (periodic refresh)',
        }),
      )

      const startTime = Date.now()

      // Get all token data at once (batched by chain) with fresh data
      const allTokenData = await this.balanceService.getAllTokenData(true)

      // Get native balances for all chains using the dedicated method
      const nativeBalanceResults = await this.balanceService.fetchAllNativeBalances(true)

      // Filter out null results and log warnings
      const nativeBalances = nativeBalanceResults.filter((result) => {
        if (result === null) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message:
                'BalanceTrackerService: Failed to fetch native balance during initialization',
              properties: {
                chainId: 'unknown',
              },
            }),
          )
          return false
        }
        return true
      })

      // Store native balances in MongoDB
      let storedNativeCount = 0
      for (const nativeBalance of nativeBalances) {
        if (nativeBalance) {
          try {
            await this.trackedBalanceRepository.upsertBalance({
              chainId: nativeBalance.chainId,
              tokenAddress: this.NATIVE_TOKEN_KEY,
              balance: nativeBalance.balance.toString(),
              blockNumber: nativeBalance.blockNumber.toString(),
            })
            storedNativeCount++
            this.logger.debug(
              EcoLogMessage.fromDefault({
                message: 'BalanceTrackerService: Native balance stored',
                properties: {
                  chainId: nativeBalance.chainId,
                  balance: nativeBalance.balance.toString(),
                  blockNumber: nativeBalance.blockNumber.toString(),
                },
              }),
            )
          } catch (error) {
            this.logger.error(
              EcoLogMessage.fromDefault({
                message: 'BalanceTrackerService: Error storing native balance',
                properties: {
                  chainId: nativeBalance.chainId,
                  error: error.message,
                },
              }),
            )
          }
        }
      }

      // Store ERC20 token balances in MongoDB
      let storedTokenCount = 0
      for (const tokenData of allTokenData) {
        try {
          await this.trackedBalanceRepository.upsertBalance({
            chainId: tokenData.chainId,
            tokenAddress: tokenData.balance.address,
            balance: tokenData.balance.balance.toString(),
            decimals: tokenData.balance.decimals,
          })
          storedTokenCount++
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'BalanceTrackerService: Token balance stored',
              properties: {
                chainId: tokenData.chainId,
                tokenAddress: tokenData.balance.address,
                balance: tokenData.balance.balance.toString(),
                decimals: tokenData.balance.decimals,
              },
            }),
          )
        } catch (error) {
          this.logger.error(
            EcoLogMessage.fromDefault({
              message: 'BalanceTrackerService: Error storing token balance',
              properties: {
                chainId: tokenData.chainId,
                tokenAddress: tokenData.balance.address,
                error: error.message,
              },
            }),
          )
        }
      }

      const duration = Date.now() - startTime
      const stats = await this.trackedBalanceRepository.getBalanceStats()

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Initialization completed',
          properties: {
            duration,
            totalBalances: stats.totalBalances,
            nativeBalancesFetched: nativeBalances.length,
            nativeBalancesStored: storedNativeCount,
            tokenBalancesFetched: allTokenData.length,
            tokenBalancesStored: storedTokenCount,
            chainCounts: stats.chainCounts,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error during initialization',
          properties: {
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Gets the current tracked balance for a specific chain/token
   */
  async getBalance(chainId: number, tokenAddress: string): Promise<bigint | null> {
    try {
      const trackedBalance = await this.trackedBalanceRepository.getBalance(chainId, tokenAddress)
      return trackedBalance ? BigInt(trackedBalance.balance) : null
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error getting balance',
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
   * Gets the full tracked balance information for a specific chain/token
   */
  async getTrackedBalance(chainId: number, tokenAddress: string): Promise<TrackedBalance | null> {
    try {
      return await this.trackedBalanceRepository.getBalance(chainId, tokenAddress)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error getting tracked balance',
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
   * Increments the balance for a specific chain/token
   */
  async incrementBalance(change: BalanceChange): Promise<bigint | null> {
    return this.updateBalance({
      ...change,
      changeAmount: Math.abs(Number(change.changeAmount)) as any,
    })
  }

  /**
   * Decrements the balance for a specific chain/token
   */
  async decrementBalance(change: BalanceChange): Promise<bigint | null> {
    return this.updateBalance({
      ...change,
      changeAmount: -Math.abs(Number(change.changeAmount)) as any,
    })
  }

  /**
   * Updates the balance directly in MongoDB (no job scheduling needed)
   */
  async updateBalance(change: BalanceChange): Promise<bigint | null> {
    try {
      // For native tokens, fetch block number if available
      let blockNumber: string | undefined
      if (change.tokenAddress === this.NATIVE_TOKEN_KEY) {
        try {
          const nativeBalanceData = await this.balanceService.fetchNativeBalance(
            change.chainId,
            true,
          )
          blockNumber = nativeBalanceData.blockNumber.toString()
        } catch (error) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message:
                'BalanceTrackerService: Failed to fetch block number for native token update',
              properties: {
                chainId: change.chainId,
                tokenAddress: change.tokenAddress,
                error: error.message,
              },
            }),
          )
        }
      }

      const result = await this.trackedBalanceRepository.updateBalanceByAmount(
        change.chainId,
        change.tokenAddress,
        change.changeAmount,
        change.transactionHash,
        blockNumber,
      )

      return result ? BigInt(result.balance) : null
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error updating balance',
          properties: {
            chainId: change.chainId,
            tokenAddress: change.tokenAddress,
            changeAmount: change.changeAmount.toString(),
            error: error.message,
          },
        }),
      )
      return null
    }
  }

  /**
   * Gets all tracked balances for a specific chain
   */
  async getBalancesForChain(chainId: number): Promise<TrackedBalance[]> {
    try {
      return await this.trackedBalanceRepository.getBalancesForChain(chainId)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error getting balances for chain',
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
      return await this.trackedBalanceRepository.getAllBalances()
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error getting all balances',
          properties: {
            error: error.message,
          },
        }),
      )
      return []
    }
  }

  /**
   * Resets and reinitializes all balances from the balance service
   */
  async resetAndReinitialize(): Promise<void> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Resetting and reinitializing balances',
        }),
      )

      // Remove all existing balances from MongoDB
      await this.trackedBalanceRepository.removeAllBalances()

      // Reinitialize
      await this.initializeBalanceTracking()

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Reset and reinitialization completed',
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error during reset and reinitialization',
          properties: {
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  // Convenience methods for common operations

  async getNativeBalance(chainId: number): Promise<bigint | null> {
    return this.getBalance(chainId, this.NATIVE_TOKEN_KEY)
  }

  async getTokenBalance(chainId: number, tokenAddress: string): Promise<bigint | null> {
    return this.getBalance(chainId, tokenAddress)
  }

  async incrementNativeBalance(
    chainId: number,
    amount: bigint,
    transactionHash?: Hex,
  ): Promise<bigint | null> {
    return this.incrementBalance({
      chainId,
      tokenAddress: this.NATIVE_TOKEN_KEY,
      changeAmount: amount,
      transactionHash,
    })
  }

  async decrementNativeBalance(
    chainId: number,
    amount: bigint,
    transactionHash?: Hex,
  ): Promise<bigint | null> {
    return this.decrementBalance({
      chainId,
      tokenAddress: this.NATIVE_TOKEN_KEY,
      changeAmount: amount,
      transactionHash,
    })
  }

  async incrementTokenBalance(
    chainId: number,
    tokenAddress: string,
    amount: bigint,
    transactionHash?: Hex,
  ): Promise<bigint | null> {
    return this.incrementBalance({
      chainId,
      tokenAddress,
      changeAmount: amount,
      transactionHash,
    })
  }

  async decrementTokenBalance(
    chainId: number,
    tokenAddress: string,
    amount: bigint,
    transactionHash?: Hex,
  ): Promise<bigint | null> {
    return this.decrementBalance({
      chainId,
      tokenAddress,
      changeAmount: amount,
      transactionHash,
    })
  }

  /**
   * Gets balance statistics
   */
  async getBalanceStats(): Promise<{ totalBalances: number; chainCounts: Record<number, number> }> {
    return this.trackedBalanceRepository.getBalanceStats()
  }
}
