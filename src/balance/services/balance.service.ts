import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { groupBy } from 'lodash'
import { RpcBalanceService } from './rpc-balance.service'
import {
  BalanceRecordRepository,
  GetCurrentBalanceResult,
} from '../repositories/balance-record.repository'
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
import {
  CreateBalanceChangeParams,
  UpdateBalanceFromRpcParams,
} from '@/balance/types/balance-service.types'
import { TokenConfig } from '@/balance/types/balance.types'

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
      const config = BALANCE_JOB_OPTIONS[BALANCE_JOBS.update_balance_record]
      const updateInterval = this.getUpdateInterval()
      const timeSlot = Math.floor(Date.now() / updateInterval)

      // Prepare job data for balance record updates
      const jobData: UpdateBalanceRecordJobData = {
        forceRefresh: true,
        triggeredAt: new Date(),
      }

      // Run immediately first
      const immediateJobId = `balance_service_init_immediate_${timeSlot}`
      await this.balanceQueue.add(BALANCE_JOBS.update_balance_record, jobData, {
        ...config,
        jobId: immediateJobId,
      })

      // Schedule recurring job using configured interval
      const recurringJobId = 'balance_service_init_recurring'
      await this.balanceQueue.add(
        BALANCE_JOBS.update_balance_record,
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
   * Calculate rewards for a given chain and token address
   * Extracted helper method to avoid code duplication
   */
  private async calculateRewards(chainId: number, address: Hex | 'native'): Promise<bigint> {
    try {
      const tokenAddress = address === 'native' ? undefined : (address as Hex)
      return await this.intentSourceRepository.calculateTotalRewardsForChainAndToken(
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
      return BigInt(0)
    }
  }

  /**
   * Get current balance for chainId/address/block including rewards from SOLVED intents
   * Defaults to latest block if no block specified
   */
  async getCurrentBalance(
    chainId: number,
    address: Hex | 'native',
    blockNumber?: string,
  ): Promise<GetCurrentBalanceResult | null> {
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
      const rewardAmount = await this.calculateRewards(chainId, address)

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
        blockHash: result.blockHash,
        decimals: result.decimals,
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
  async getNativeBalance(
    chainId: number,
    blockNumber?: string,
  ): Promise<GetCurrentBalanceResult | null> {
    return this.getCurrentBalance(chainId, 'native', blockNumber)
  }

  /**
   * Get current token balance
   */
  async getTokenBalance(
    chainId: number,
    tokenAddress: Hex,
    blockNumber?: string,
  ): Promise<GetCurrentBalanceResult | null> {
    return this.getCurrentBalance(chainId, tokenAddress, blockNumber)
  }

  /**
   * Get token balances for all solver tokens on a given chain
   * Returns a Record mapping token addresses to their balance results
   */
  async getTokenBalances(
    chainId: number,
    tokenAddresses: Hex[],
    blockNumber?: string,
  ): Promise<Record<Hex, GetCurrentBalanceResult>> {
    const results: Record<Hex, GetCurrentBalanceResult> = {}

    // Process tokens in parallel for efficiency
    const balancePromises = tokenAddresses.map(async (address) => {
      const balance = await this.getCurrentBalance(chainId, address, blockNumber)
      return { address, balance }
    })

    const balanceResults = await Promise.all(balancePromises)

    // Build the result record, filtering out null results
    for (const { address, balance } of balanceResults) {
      if (balance) {
        results[address] = balance
      }
    }

    return results
  }

  /**
   * Get token balances for all solver tokens on a given chain
   * Uses the solver configuration to determine which tokens to fetch
   */
  async getTokenBalancesForSolver(
    chainId: number,
    blockNumber?: string,
  ): Promise<Record<Hex, GetCurrentBalanceResult>> {
    try {
      const solver = this.configService.getSolver(BigInt(chainId))
      if (!solver) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'BalanceService: No solver found for chain',
            properties: { chainId },
          }),
        )
        return {}
      }

      // Get all token addresses for this solver
      const tokenAddresses = Object.keys(solver.targets) as Hex[]

      return this.getTokenBalances(chainId, tokenAddresses, blockNumber)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting token balances for solver',
          properties: {
            chainId,
            error: error.message,
          },
        }),
      )
      return {}
    }
  }

  /**
   * Create balance change from watch services (only called by job processors)
   */
  async createBalanceChange(params: CreateBalanceChangeParams) {
    try {
      const result = await this.balanceChangeRepository.createBalanceChange({
        chainId: params.chainId.toString(),
        address: params.address,
        changeAmount: params.changeAmount,
        direction: params.direction,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        transactionHash: params.transactionHash,
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
            decimals: 18, // Native tokens typically have 18 decimals
            tokenSymbol: 'ETH', // Default native token symbol
            tokenName: 'Ethereum', // Default native token name
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
   * Get all native balances for all configured chains
   * Similar to RpcBalanceService.fetchAllNativeBalances but uses local database
   */
  async getAllNativeBalances(): Promise<
    Array<{ chainId: number; balance: bigint; blockNumber: string } | null>
  > {
    try {
      const chainIds = Object.keys(this.configService.getSolvers()).map(Number)
      const nativeBalancePromises = chainIds.map(async (chainId) => {
        try {
          const nativeBalanceResult = await this.getNativeBalance(chainId)
          if (!nativeBalanceResult) {
            return null
          }
          return {
            chainId,
            balance: nativeBalanceResult.balance,
            blockNumber: nativeBalanceResult.blockNumber,
          }
        } catch (error) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: 'BalanceService: Error getting native balance for chain',
              properties: {
                chainId,
                error: error.message,
              },
            }),
          )
          return null
        }
      })

      return Promise.all(nativeBalancePromises)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'BalanceService: Error getting all native balances',
          properties: {
            error: error.message,
          },
        }),
      )
      return []
    }
  }

  /**
   * Update balance record from RPC call (only called by job processors)
   */
  async updateBalanceFromRpc(params: UpdateBalanceFromRpcParams) {
    try {
      const result = await this.balanceRecordRepository.updateFromRpc({
        chainId: params.chainId.toString(),
        address: params.address,
        balance: params.balance,
        blockNumber: params.blockNumber,
        blockHash: params.blockHash,
        decimals: params.decimals ?? 18,
        tokenSymbol: params.tokenSymbol ?? '',
        tokenName: params.tokenName ?? '',
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

  /**
   * Get all token data for tokens across all chains.
   * Similar to RpcBalanceService.getAllTokenDataForAddress but uses the BalanceService
   * database-backed getTokenBalances method instead of direct RPC calls.
   * Note: walletAddress parameter is maintained for API compatibility but not used
   * since BalanceService tracks the solver's own balances.
   *
   * @param walletAddress - Wallet address (for API compatibility, not used in database queries)
   * @param tokens - Array of TokenConfig objects specifying which tokens to fetch
   * @param blockNumber - Optional block number to fetch balances at
   * @returns Promise resolving to array of objects containing config, balance, and chainId
   */
  async getAllTokenDataForAddress(
    tokens: TokenConfig[],
    blockNumber?: string,
  ): Promise<
    Array<{
      config: TokenConfig
      balance: GetCurrentBalanceResult
      chainId: number
    }>
  > {
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      try {
        const configs = tokensByChainId[chainId]
        const tokenAddresses = configs.map((token) => token.address)

        const balances = await this.getTokenBalances(parseInt(chainId), tokenAddresses, blockNumber)

        // Map configs to their corresponding balance results
        return configs
          .map((config) => {
            const balance = balances[config.address]
            if (balance) {
              return {
                config,
                balance,
                chainId: parseInt(chainId),
              }
            }
            return null
          })
          .filter((item) => item !== null) // Filter out null results
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'BalanceService.getAllTokenDataForAddress: Error getting token data for chain',
            properties: {
              chainId,
              error: error.message,
            },
          }),
        )
        return [] // Return empty array for failed chains
      }
    })

    try {
      const results = await Promise.all(balancesPerChainIdPromise)
      return results.flat()
    } catch {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message:
            'BalanceService.getAllTokenDataForAddress: Error getting all token data for address',
          properties: {
            tokens,
            blockNumber,
          },
        }),
      )
      return []
    }
  }
}
