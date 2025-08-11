import { Injectable, Logger } from '@nestjs/common'
import { BatchWithdraws, BatchWithdrawGasless, SendBatchData, EcoLogMessage } from '@libs/shared'

@Injectable()
export class IndexerDomainService {
  private readonly logger = new Logger(IndexerDomainService.name)

  /**
   * Filter gasless intents from a mixed array of batch records
   * @param records Array of batch withdrawal records
   * @returns Filtered array containing only non-gasless intents
   */
  filterGaslessIntents(records: (BatchWithdraws | BatchWithdrawGasless)[]): BatchWithdraws[] {
    const withdrawals: BatchWithdraws[] = []
    
    records.forEach((record) => {
      if (!this.isGaslessIntent(record)) {
        withdrawals.push(record)
      }
    })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'filtered gasless intents',
        properties: { 
          totalRecords: records.length, 
          filteredRecords: withdrawals.length,
          gaslessCount: records.length - withdrawals.length
        }
      })
    )

    return withdrawals
  }

  /**
   * Validate batch withdrawal data according to business rules
   * @param withdrawals Array of batch withdrawals to validate
   * @returns True if all withdrawals are valid
   */
  validateBatchWithdrawals(withdrawals: BatchWithdraws[]): boolean {
    if (!withdrawals || withdrawals.length === 0) {
      return true // Empty array is valid
    }

    const invalidWithdrawals = withdrawals.filter(withdrawal => {
      // Validate intent structure
      if (!withdrawal.intent?.hash || !withdrawal.intent?.creator) {
        return true // Mark as invalid
      }

      // Validate claimant structure
      if (!withdrawal.claimant?._hash || !withdrawal.claimant?._claimant) {
        return true // Mark as invalid
      }

      // Validate hash consistency
      if (withdrawal.intent.hash !== withdrawal.claimant._hash) {
        return true // Mark as invalid
      }

      return false // Valid withdrawal
    })

    const isValid = invalidWithdrawals.length === 0

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'validated batch withdrawals',
        properties: { 
          totalWithdrawals: withdrawals.length,
          invalidCount: invalidWithdrawals.length,
          isValid
        }
      })
    )

    if (!isValid) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'invalid batch withdrawals detected',
          properties: { 
            invalidWithdrawals: invalidWithdrawals.map(w => ({
              hash: w.intent?.hash,
              claimantHash: w.claimant?._hash
            }))
          }
        })
      )
    }

    return isValid
  }

  /**
   * Calculate batch priority based on business rules
   * @param batches Array of send batch data to prioritize
   * @returns Sorted array with highest priority batches first
   */
  calculateBatchPriority(batches: SendBatchData[]): SendBatchData[] {
    if (!batches || batches.length === 0) {
      return []
    }

    const prioritizedBatches = [...batches].sort((a, b) => {
      // Priority 1: High-value chains (mainnet) first
      const aIsMainnet = this.isMainnetChain(a.chainId)
      const bIsMainnet = this.isMainnetChain(b.chainId)
      
      if (aIsMainnet && !bIsMainnet) return -1
      if (!aIsMainnet && bIsMainnet) return 1

      // Priority 2: Cross-chain transactions (different source/dest) first
      const aIsCrossChain = a.chainId !== a.destinationChainId
      const bIsCrossChain = b.chainId !== b.destinationChainId

      if (aIsCrossChain && !bIsCrossChain) return -1
      if (!aIsCrossChain && bIsCrossChain) return 1

      // Priority 3: Sort by chain ID for consistency
      return a.chainId - b.chainId
    })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'calculated batch priority',
        properties: { 
          totalBatches: batches.length,
          priorityOrder: prioritizedBatches.slice(0, 5).map(b => ({
            chainId: b.chainId,
            destChainId: b.destinationChainId,
            hash: b.hash
          }))
        }
      })
    )

    return prioritizedBatches
  }

  /**
   * Determine optimal batch size for processing
   * @param totalItems Total number of items to process
   * @param maxBatchSize Maximum allowed batch size
   * @returns Optimal batch size for processing
   */
  determineOptimalBatchSize(totalItems: number, maxBatchSize = 100): number {
    if (totalItems <= 0) return 0
    if (totalItems <= 10) return totalItems
    if (totalItems <= maxBatchSize) return Math.min(50, totalItems)
    
    // For large datasets, use a batch size that creates reasonably sized chunks
    const optimalSize = Math.min(maxBatchSize, Math.ceil(totalItems / 10))
    
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'determined optimal batch size',
        properties: { totalItems, maxBatchSize, optimalSize }
      })
    )

    return optimalSize
  }

  /**
   * Check if a record represents a gasless intent
   * @param record The record to check
   * @returns True if the record is a gasless intent
   */
  private isGaslessIntent(
    record: BatchWithdraws | BatchWithdrawGasless,
  ): record is BatchWithdrawGasless {
    return 'intentHash' in record.intent
  }

  /**
   * Check if a chain ID represents a mainnet chain
   * @param chainId Chain ID to check
   * @returns True if the chain is a mainnet chain
   */
  private isMainnetChain(chainId: number): boolean {
    const mainnetChains = [1, 10, 137, 42161, 8453, 56, 43114] // Major mainnet chains
    return mainnetChains.includes(chainId)
  }
}