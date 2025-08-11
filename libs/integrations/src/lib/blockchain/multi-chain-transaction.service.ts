import { Injectable, Logger } from '@nestjs/common'
import { PublicClient, Log, GetLogsParameters, Block } from 'viem'
import { MultichainPublicClientService } from '../multichain/multichain-public-client.service'
import { EcoLogMessage, EcoError, ChainValidationUtils, ANALYTICS_EVENTS } from '@libs/shared'
import { EcoAnalyticsService } from '../analytics/eco-analytics.service'

export interface EventQuery {
  address?: string | string[]
  topics?: (string | string[] | null)[]
  fromBlock?: bigint | 'earliest' | 'latest' | 'pending' | 'safe' | 'finalized'
  toBlock?: bigint | 'earliest' | 'latest' | 'pending' | 'safe' | 'finalized'
}

export interface ContractValidation {
  exists: boolean
  isContract: boolean
  chainId: number
  address: string
  blockNumber?: bigint
}

export interface ChainStatus {
  chainId: number
  isHealthy: boolean
  latestBlock: bigint
  blockTime: Date
  rpcEndpoint?: string
}

@Injectable()
export class MultiChainTransactionService {
  private readonly logger = new Logger(MultiChainTransactionService.name)
  private readonly clientCache = new Map<number, { client: PublicClient; lastUsed: number }>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly publicClientService: MultichainPublicClientService,
    private readonly ecoAnalytics: EcoAnalyticsService
  ) {}

  /**
   * Get contract events from a specific chain
   * @param chainId Chain ID to query
   * @param contractAddress Contract address to query
   * @param eventQuery Event query parameters
   * @returns Promise resolving to array of logs
   */
  async getContractEvents(
    chainId: number,
    contractAddress: string,
    eventQuery: EventQuery
  ): Promise<Log[]> {
    const startTime = Date.now()
    
    if (!ChainValidationUtils.validateChainID(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`)
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'fetching contract events',
        properties: { 
          chainId, 
          contractAddress, 
          fromBlock: eventQuery.fromBlock?.toString(),
          toBlock: eventQuery.toBlock?.toString()
        }
      })
    )

    try {
      const client = await this.getClient(chainId)
      
      const logsParams: GetLogsParameters = {
        address: contractAddress as `0x${string}`,
        fromBlock: eventQuery.fromBlock || 'earliest',
        toBlock: eventQuery.toBlock || 'latest',
        topics: eventQuery.topics
      }

      const logs = await client.getLogs(logsParams)

      // Track successful event fetch
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.CONTRACT_EVENTS_FETCHED, {
        chainId,
        contractAddress,
        logCount: logs.length,
        fromBlock: eventQuery.fromBlock?.toString(),
        toBlock: eventQuery.toBlock?.toString(),
        duration: Date.now() - startTime
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'successfully fetched contract events',
          properties: { 
            chainId, 
            contractAddress, 
            logCount: logs.length,
            duration: Date.now() - startTime
          }
        })
      )

      return logs
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to fetch contract events',
          error: EcoError.getErrorObject(error),
          properties: { 
            chainId, 
            contractAddress,
            duration: Date.now() - startTime
          }
        })
      )

      // Track fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.CONTRACT_EVENTS_FETCH_ERROR, error, {
        chainId,
        contractAddress,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Get current block number for a specific chain
   * @param chainId Chain ID to query
   * @returns Promise resolving to current block number
   */
  async getBlockNumber(chainId: number): Promise<bigint> {
    if (!ChainValidationUtils.validateChainID(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`)
    }

    try {
      const client = await this.getClient(chainId)
      const blockNumber = await client.getBlockNumber()

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'fetched current block number',
          properties: { chainId, blockNumber: blockNumber.toString() }
        })
      )

      return blockNumber
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to fetch block number',
          error: EcoError.getErrorObject(error),
          properties: { chainId }
        })
      )

      // Track block number fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.BLOCK_NUMBER_FETCH_ERROR, error, {
        chainId
      })

      throw error
    }
  }

  /**
   * Get block information for a specific block
   * @param chainId Chain ID to query
   * @param blockNumber Block number or tag
   * @returns Promise resolving to block information
   */
  async getBlock(
    chainId: number,
    blockNumber: bigint | 'latest' | 'earliest' | 'pending' = 'latest'
  ): Promise<Block> {
    if (!ChainValidationUtils.validateChainID(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`)
    }

    try {
      const client = await this.getClient(chainId)
      const block = await client.getBlock({ blockNumber })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'fetched block information',
          properties: { 
            chainId, 
            requestedBlock: blockNumber.toString(),
            actualBlock: block.number.toString(),
            timestamp: new Date(Number(block.timestamp) * 1000).toISOString()
          }
        })
      )

      return block
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to fetch block information',
          error: EcoError.getErrorObject(error),
          properties: { chainId, blockNumber: blockNumber.toString() }
        })
      )

      throw error
    }
  }

  /**
   * Validate that a contract exists at the given address
   * @param chainId Chain ID to check
   * @param address Contract address to validate
   * @returns Promise resolving to validation result
   */
  async validateContractExists(chainId: number, address: string): Promise<ContractValidation> {
    if (!ChainValidationUtils.validateChainID(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}`)
    }

    const startTime = Date.now()

    try {
      const client = await this.getClient(chainId)
      const [code, blockNumber] = await Promise.all([
        client.getBytecode({ address: address as `0x${string}` }),
        client.getBlockNumber()
      ])

      const validation: ContractValidation = {
        exists: code !== undefined && code !== '0x',
        isContract: code !== undefined && code !== '0x' && code.length > 2,
        chainId,
        address,
        blockNumber
      }

      // Track validation
      this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.CONTRACT_VALIDATION, {
        chainId,
        address,
        exists: validation.exists,
        isContract: validation.isContract,
        duration: Date.now() - startTime
      })

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'validated contract existence',
          properties: { 
            ...validation,
            blockNumber: blockNumber.toString(),
            duration: Date.now() - startTime
          }
        })
      )

      return validation
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'failed to validate contract',
          error: EcoError.getErrorObject(error),
          properties: { chainId, address, duration: Date.now() - startTime }
        })
      )

      // Track validation error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BLOCKCHAIN.CONTRACT_VALIDATION_ERROR, error, {
        chainId,
        address,
        duration: Date.now() - startTime
      })

      throw error
    }
  }

  /**
   * Get health status for multiple chains
   * @param chainIds Array of chain IDs to check
   * @returns Promise resolving to array of chain status
   */
  async getMultiChainStatus(chainIds: number[]): Promise<ChainStatus[]> {
    const statusPromises = chainIds.map(async (chainId): Promise<ChainStatus> => {
      try {
        const [blockNumber, block] = await Promise.all([
          this.getBlockNumber(chainId),
          this.getBlock(chainId, 'latest')
        ])

        return {
          chainId,
          isHealthy: true,
          latestBlock: blockNumber,
          blockTime: new Date(Number(block.timestamp) * 1000)
        }
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.withError({
            message: 'chain health check failed',
            error: EcoError.getErrorObject(error),
            properties: { chainId }
          })
        )

        return {
          chainId,
          isHealthy: false,
          latestBlock: 0n,
          blockTime: new Date()
        }
      }
    })

    const results = await Promise.all(statusPromises)

    const healthyChains = results.filter(status => status.isHealthy).length
    
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'multi-chain status check completed',
        properties: { 
          totalChains: chainIds.length,
          healthyChains,
          unhealthyChains: chainIds.length - healthyChains
        }
      })
    )

    // Track multi-chain status
    this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.MULTI_CHAIN_STATUS, {
      totalChains: chainIds.length,
      healthyChains,
      unhealthyChains: chainIds.length - healthyChains,
      chainIds
    })

    return results
  }

  /**
   * Batch fetch events from multiple chains
   * @param requests Array of chain/contract/query combinations
   * @returns Promise resolving to array of results
   */
  async batchFetchEvents(
    requests: Array<{
      chainId: number
      contractAddress: string
      eventQuery: EventQuery
    }>
  ): Promise<Array<{ chainId: number; contractAddress: string; logs: Log[]; error?: Error }>> {
    const startTime = Date.now()
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'starting batch event fetch',
        properties: { requestCount: requests.length }
      })
    )

    const results = await Promise.allSettled(
      requests.map(async request => {
        const logs = await this.getContractEvents(
          request.chainId,
          request.contractAddress,
          request.eventQuery
        )
        return { ...request, logs }
      })
    )

    const processedResults = results.map((result, index) => {
      const request = requests[index]
      
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          chainId: request.chainId,
          contractAddress: request.contractAddress,
          logs: [],
          error: EcoError.getErrorObject(result.reason)
        }
      }
    })

    const successfulRequests = processedResults.filter(r => !r.error).length
    const totalLogs = processedResults.reduce((sum, r) => sum + r.logs.length, 0)

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'batch event fetch completed',
        properties: { 
          totalRequests: requests.length,
          successfulRequests,
          failedRequests: requests.length - successfulRequests,
          totalLogs,
          duration: Date.now() - startTime
        }
      })
    )

    // Track batch fetch results
    this.ecoAnalytics.trackEvent(ANALYTICS_EVENTS.BLOCKCHAIN.BATCH_EVENTS_FETCHED, {
      totalRequests: requests.length,
      successfulRequests,
      failedRequests: requests.length - successfulRequests,
      totalLogs,
      duration: Date.now() - startTime
    })

    return processedResults
  }

  /**
   * Get or create a cached client for the specified chain
   * @param chainId Chain ID
   * @returns Promise resolving to public client
   */
  private async getClient(chainId: number): Promise<PublicClient> {
    const cached = this.clientCache.get(chainId)
    const now = Date.now()

    if (cached && (now - cached.lastUsed) < this.CACHE_DURATION) {
      cached.lastUsed = now
      return cached.client
    }

    const client = await this.publicClientService.getClient(chainId)
    this.clientCache.set(chainId, { client, lastUsed: now })

    // Clean up old cache entries
    this.cleanupCache(now)

    return client
  }

  /**
   * Clean up expired cache entries
   * @param now Current timestamp
   */
  private cleanupCache(now: number): void {
    for (const [chainId, cached] of this.clientCache.entries()) {
      if ((now - cached.lastUsed) >= this.CACHE_DURATION) {
        this.clientCache.delete(chainId)
      }
    }
  }
}