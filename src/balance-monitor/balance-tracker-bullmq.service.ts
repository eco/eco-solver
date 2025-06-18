import { BalanceService } from '@/balance/balance.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { QUEUES } from '@/common/redis/constants'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { BalanceChange, TrackedBalance } from './interfaces/balance-tracker.interface'
import {
  BALANCE_MONITOR_JOBS,
  BALANCE_TRACKER_JOB_OPTIONS,
  StoreBalanceJobData,
  UpdateBalanceJobData,
} from './jobs/balance-monitor.job'

/**
 * Balance tracker service using BullMQ for both job management and balance storage.
 * Balances are stored as completed job data, eliminating the need for separate Redis operations.
 */
@Injectable()
export class BalanceTrackerService implements OnModuleInit {
  private readonly logger = new Logger(BalanceTrackerService.name)
  private readonly NATIVE_TOKEN_KEY = 'native'

  constructor(
    @InjectQueue(QUEUES.BALANCE_MONITOR.queue) private readonly balanceQueue: Queue,
    private readonly balanceService: BalanceService,
  ) {}

  async onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'BalanceTrackerService: Initializing balance tracking',
      }),
    )

    // Schedule initialization job with BullMQ's built-in deduplication
    await this.scheduleInitialization()
  }

  /**
   * Schedules the initialization job using BullMQ's jobId for deduplication
   */
  private async scheduleInitialization(): Promise<void> {
    try {
      const config = BALANCE_TRACKER_JOB_OPTIONS[BALANCE_MONITOR_JOBS.initialize_monitoring]
      await this.balanceQueue.add(
        BALANCE_MONITOR_JOBS.initialize_monitoring,
        {},
        {
          ...config,
        },
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Initialization job scheduled',
          properties: { jobId: config.jobId },
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
   * Initializes balance tracking by fetching current balances and storing them as jobs
   */
  async initializeBalanceTracking(): Promise<void> {
    try {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Starting balance tracking initialization',
        }),
      )

      const balanceJobs: Array<{ jobId: string; data: StoreBalanceJobData }> = []

      // Get all token data at once (batched by chain) with fresh data
      const allTokenData = await this.balanceService.getAllTokenData(true)

      // Get native balances for all chains using the dedicated method
      const nativeBalanceResults = await this.balanceService.fetchAllNativeBalances(true)

      // Log warnings for failed fetches and filter out nulls
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

      // Create balance jobs for native tokens
      for (const nativeBalance of nativeBalances) {
        if (nativeBalance) {
          balanceJobs.push({
            jobId: this.getBalanceJobId(nativeBalance.chainId, this.NATIVE_TOKEN_KEY),
            data: {
              chainId: nativeBalance.chainId,
              tokenAddress: this.NATIVE_TOKEN_KEY,
              balance: nativeBalance.balance.toString(),
              lastUpdated: new Date().toISOString(),
            },
          })
        }
      }

      // Create balance jobs for ERC20 tokens from the batched data
      for (const tokenData of allTokenData) {
        balanceJobs.push({
          jobId: this.getBalanceJobId(tokenData.chainId, tokenData.balance.address),
          data: {
            chainId: tokenData.chainId,
            tokenAddress: tokenData.balance.address,
            balance: tokenData.balance.balance.toString(),
            lastUpdated: new Date().toISOString(),
            decimals: tokenData.balance.decimals,
          },
        })
      }

      // Store all balances as completed jobs in BullMQ
      await this.storeBalanceJobs(balanceJobs)

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Initialization completed',
          properties: {
            balancesInitialized: balanceJobs.length,
            nativeBalances: nativeBalances.length,
            tokenBalances: allTokenData.length,
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
   * Stores balance jobs in BullMQ as completed jobs
   */
  private async storeBalanceJobs(
    balanceJobs: Array<{ jobId: string; data: StoreBalanceJobData }>,
  ): Promise<void> {
    for (const { jobId, data } of balanceJobs) {
      // Create a job that will be processed and then serve as balance storage
      await this.balanceQueue.add(BALANCE_MONITOR_JOBS.store_balance, data, {
        jobId,
        removeOnComplete: false, // Keep completed jobs to serve as balance storage
        removeOnFail: 1,
      })
    }
  }

  /**
   * Generates a unique job ID for balance storage
   */
  private getBalanceJobId(chainId: number, tokenAddress: string): string {
    return `balance-${chainId}-${tokenAddress}`
  }

  /**
   * Gets the current tracked balance for a specific chain/token
   */
  async getBalance(chainId: number, tokenAddress: string): Promise<bigint | null> {
    try {
      const jobId = this.getBalanceJobId(chainId, tokenAddress)
      const job = await this.balanceQueue.getJob(jobId)

      if (!job || (await job.getState()) !== 'completed') {
        return null
      }

      const data = job.data as StoreBalanceJobData
      return BigInt(data.balance)
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
      const jobId = this.getBalanceJobId(chainId, tokenAddress)
      const job = await this.balanceQueue.getJob(jobId)

      if (!job || (await job.getState()) !== 'completed') {
        return null
      }

      const data = job.data as StoreBalanceJobData
      return {
        chainId: data.chainId,
        tokenAddress: data.tokenAddress,
        balance: BigInt(data.balance),
        lastUpdated: new Date(data.lastUpdated),
      }
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
   * Updates the balance by scheduling an update job
   */
  async updateBalance(change: BalanceChange): Promise<bigint | null> {
    try {
      const updateData: UpdateBalanceJobData = {
        chainId: change.chainId,
        tokenAddress: change.tokenAddress,
        changeAmount: change.changeAmount.toString(),
        transactionHash: change.transactionHash,
        timestamp: (change.timestamp || new Date()).toISOString(),
      }

      // Schedule update job with unique ID to prevent duplicate processing
      const updateJobId = `update-${change.chainId}-${change.tokenAddress}-${Date.now()}`
      await this.balanceQueue.add(BALANCE_MONITOR_JOBS.update_balance, updateData, {
        ...BALANCE_TRACKER_JOB_OPTIONS[BALANCE_MONITOR_JOBS.update_balance],
        jobId: updateJobId,
      })

      // Return the updated balance (the job processor will handle the actual update)
      const currentBalance = await this.getBalance(change.chainId, change.tokenAddress)
      if (currentBalance === null) {
        return null
      }

      const newBalance = currentBalance + change.changeAmount
      return newBalance >= 0n ? newBalance : currentBalance
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error scheduling balance update',
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
   * Processes a balance update job (called by the processor)
   */
  async processBalanceUpdate(updateData: UpdateBalanceJobData): Promise<void> {
    try {
      const { chainId, tokenAddress, changeAmount } = updateData
      const changeAmountBigInt = BigInt(changeAmount)

      // Get current balance
      const currentBalance = await this.getBalance(chainId, tokenAddress)
      if (currentBalance === null) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'BalanceTrackerService: Attempted to update non-existent balance',
            properties: {
              chainId,
              tokenAddress,
              changeAmount,
            },
          }),
        )
        return
      }

      const newBalance = currentBalance + changeAmountBigInt

      // Prevent negative balances
      if (newBalance < 0n) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'BalanceTrackerService: Attempted to create negative balance',
            properties: {
              chainId,
              tokenAddress,
              currentBalance: currentBalance.toString(),
              changeAmount,
              wouldBeBalance: newBalance.toString(),
            },
          }),
        )
        return
      }

      // Update the balance job
      const jobId = this.getBalanceJobId(chainId, tokenAddress)
      const job = await this.balanceQueue.getJob(jobId)

      if (job) {
        // Update the job data with new balance
        const currentData = job.data as StoreBalanceJobData
        const updatedData: StoreBalanceJobData = {
          ...currentData,
          balance: newBalance.toString(),
          lastUpdated: updateData.timestamp || new Date().toISOString(),
        }

        // Remove old job and create new one with updated balance
        await job.remove()
        const newJob = await this.balanceQueue.add(
          BALANCE_MONITOR_JOBS.store_balance,
          updatedData,
          {
            jobId,
            removeOnComplete: false,
            removeOnFail: 1,
          },
        )
        await newJob.moveToCompleted('updated', newJob.token!)
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Balance updated',
          properties: {
            chainId,
            tokenAddress,
            previousBalance: currentBalance.toString(),
            changeAmount,
            newBalance: newBalance.toString(),
            transactionHash: updateData.transactionHash,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceTrackerService: Error processing balance update',
          properties: {
            updateData,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Gets all tracked balances for a specific chain
   */
  async getBalancesForChain(chainId: number): Promise<TrackedBalance[]> {
    try {
      const jobs = await this.balanceQueue.getCompleted(0, 1000)
      const balances: TrackedBalance[] = []

      for (const job of jobs) {
        if (job.name === BALANCE_MONITOR_JOBS.store_balance) {
          const data = job.data as StoreBalanceJobData
          if (data.chainId === chainId) {
            balances.push({
              chainId: data.chainId,
              tokenAddress: data.tokenAddress,
              balance: BigInt(data.balance),
              lastUpdated: new Date(data.lastUpdated),
            })
          }
        }
      }

      return balances
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
      const jobs = await this.balanceQueue.getCompleted(0, 1000)
      const balances: TrackedBalance[] = []

      for (const job of jobs) {
        if (job.name === BALANCE_MONITOR_JOBS.store_balance) {
          const data = job.data as StoreBalanceJobData
          balances.push({
            chainId: data.chainId,
            tokenAddress: data.tokenAddress,
            balance: BigInt(data.balance),
            lastUpdated: new Date(data.lastUpdated),
          })
        }
      }

      return balances
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

      // Remove all existing balance jobs
      const jobs = await this.balanceQueue.getCompleted(0, 1000)
      for (const job of jobs) {
        if (job.name === BALANCE_MONITOR_JOBS.store_balance) {
          await job.remove()
        }
      }

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
}
