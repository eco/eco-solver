import { Hex } from 'viem'
import { hashIntent, encodeIntent, IntentType } from '@eco/foundation-eco-adapter'
import { IntentModel } from '../models/intent.model'
import { CreateIntentParams } from '../types/intent.types'

// Domain utility functions for intent operations
export class IntentUtils {
  /**
   * Calculate the hash of an intent
   */
  static calculateHash(intent: IntentType): Hex {
    return hashIntent(intent).intentHash
  }

  /**
   * Encode an intent for contract interaction
   */
  static encodeIntent(intent: IntentType): Hex {
    return encodeIntent(intent)
  }

  /**
   * Validate intent parameters before creation
   */
  static validateParams(params: CreateIntentParams): boolean {
    // Basic validation
    if (params.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return false // Deadline in the past
    }
    
    if (params.rewardTokens.length === 0 && params.nativeValue === 0n) {
      return false // No rewards
    }
    
    if (params.calls.length === 0) {
      return false // No calls to execute
    }
    
    return true
  }

  /**
   * Check if an intent is economically feasible
   */
  static isEconomicallyFeasible(intent: IntentModel, estimatedGasCost: bigint): boolean {
    const totalRewards = intent.getTotalRewardValue()
    const minProfitMargin = totalRewards / 10n // 10% minimum margin
    
    return totalRewards > estimatedGasCost + minProfitMargin
  }

  /**
   * Calculate time until expiry
   */
  static getTimeToExpiry(intent: IntentModel): number {
    const now = BigInt(Math.floor(Date.now() / 1000))
    const timeRemaining = Number(intent.reward.deadline - now)
    return Math.max(0, timeRemaining)
  }

  /**
   * Generate a unique job ID for intent processing
   */
  static generateJobId(serviceName: string, intentHash: Hex, logIndex: number = 0): string {
    return `${serviceName}-${intentHash}-${logIndex}`
  }

  /**
   * Extract intent identifier for logging
   */
  static getIntentIdentifier(intent: IntentModel): string {
    const shortHash = intent.hash.slice(0, 10)
    return `${shortHash}...${intent.logIndex}`
  }
}