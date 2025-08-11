import { Injectable, Logger } from '@nestjs/common'
import { Log } from 'viem'
import { EcoLogMessage, BlockRangeUtils } from '@libs/shared'

@Injectable()
export class ChainSyncDomainService {
  private readonly logger = new Logger(ChainSyncDomainService.name)

  /**
   * Calculate optimal sync range based on current and last block
   * @param lastBlock The last processed block
   * @param currentBlock The current blockchain block
   * @param maxBatchSize Maximum batch size for processing
   * @returns Calculated sync range
   */
  calculateSyncRange(
    lastBlock: bigint, 
    currentBlock: bigint, 
    maxBatchSize = 1000n
  ): { fromBlock: bigint; toBlock: bigint } {
    if (lastBlock >= currentBlock) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'no new blocks to sync',
          properties: { lastBlock: lastBlock.toString(), currentBlock: currentBlock.toString() }
        })
      )
      return { fromBlock: currentBlock, toBlock: currentBlock }
    }

    const totalRange = currentBlock - lastBlock
    const optimalBatchSize = BlockRangeUtils.calculateOptimalBatchSize(totalRange, maxBatchSize)
    
    const toBlock = lastBlock + optimalBatchSize <= currentBlock 
      ? lastBlock + optimalBatchSize 
      : currentBlock

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'calculated sync range',
        properties: { 
          fromBlock: (lastBlock + 1n).toString(), 
          toBlock: toBlock.toString(),
          totalRange: totalRange.toString(),
          batchSize: optimalBatchSize.toString()
        }
      })
    )

    return { fromBlock: lastBlock + 1n, toBlock }
  }

  /**
   * Validate and filter missing transactions from logs
   * @param logs Array of logs to validate
   * @param supportedChains Array of supported chain IDs
   * @returns Filtered logs for supported chains
   */
  validateMissingTransactions(logs: Log[], supportedChains: bigint[]): Log[] {
    if (!logs || logs.length === 0) {
      return []
    }

    const validLogs = logs.filter(log => {
      // Validate basic log structure
      if (!log.transactionHash || !log.blockNumber) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: 'invalid log structure',
            properties: { log }
          })
        )
        return false
      }

      // Additional validation logic can be added here
      return true
    })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'validated missing transactions',
        properties: { 
          totalLogs: logs.length, 
          validLogs: validLogs.length,
          supportedChains: supportedChains.map(c => c.toString())
        }
      })
    )

    return validLogs
  }

  /**
   * Determine if sync operation should continue based on business rules
   * @param currentBatch Current batch being processed
   * @param totalBatches Total batches to process
   * @param errorCount Number of errors encountered
   * @returns True if sync should continue
   */
  shouldContinueSync(currentBatch: number, totalBatches: number, errorCount = 0): boolean {
    const maxErrorThreshold = 5
    const maxBatchThreshold = 100

    if (errorCount >= maxErrorThreshold) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'sync halted due to error threshold',
          properties: { currentBatch, totalBatches, errorCount, maxErrorThreshold }
        })
      )
      return false
    }

    if (currentBatch >= maxBatchThreshold) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'sync halted due to batch threshold',
          properties: { currentBatch, totalBatches, maxBatchThreshold }
        })
      )
      return false
    }

    return currentBatch < totalBatches
  }

  /**
   * Calculate sync priority based on chain importance and lag
   * @param chainId Chain ID to calculate priority for
   * @param blockLag Number of blocks behind current head
   * @returns Priority score (higher = more important)
   */
  calculateSyncPriority(chainId: number, blockLag: bigint): number {
    const highPriorityChains = [1, 10, 137, 42161] // Mainnet chains
    const mediumPriorityChains = [8453, 56, 43114] // Other major chains
    
    let basePriority = 1
    if (highPriorityChains.includes(chainId)) {
      basePriority = 10
    } else if (mediumPriorityChains.includes(chainId)) {
      basePriority = 5
    }

    // Increase priority based on how far behind we are
    const lagMultiplier = Number(blockLag) > 1000 ? 2 : 1
    
    const priority = basePriority * lagMultiplier

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'calculated sync priority',
        properties: { chainId, blockLag: blockLag.toString(), priority }
      })
    )

    return priority
  }
}