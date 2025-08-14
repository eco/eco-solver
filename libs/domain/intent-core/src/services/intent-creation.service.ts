import { Injectable } from '@nestjs/common'
import { Hex } from 'viem'
import { IntentModel } from '../models/intent.model'
import { IntentUtils } from '../utils/intent.utils'
import { CreateIntentParams } from '../types/intent.types'
import { IIntentCreationService } from './intent.service.interface'

/**
 * Domain service for intent creation
 * This is a proof of concept showing how to structure domain logic
 */
@Injectable()
export class IntentCreationService implements IIntentCreationService {
  async createIntent(params: CreateIntentParams): Promise<Hex> {
    // Validate parameters using domain utilities
    if (!IntentUtils.validateParams(params)) {
      throw new Error('Invalid intent parameters')
    }

    // Create domain model
    const intent = new IntentModel(params)

    // Verify the intent can be fulfilled
    if (!intent.canBeFulfilled()) {
      throw new Error('Intent cannot be fulfilled')
    }

    // Calculate and verify hash matches
    const calculatedHash = IntentUtils.calculateHash(intent)
    if (calculatedHash !== params.hash) {
      throw new Error('Intent hash mismatch')
    }

    // Return the intent hash for further processing
    return intent.hash
  }

  async validateIntent(params: CreateIntentParams): Promise<boolean> {
    try {
      // Use domain utilities for validation
      if (!IntentUtils.validateParams(params)) {
        return false
      }

      // Additional domain-specific validations
      const intent = new IntentModel(params)

      // Check if economically feasible (simplified)
      const estimatedGas = 100000n // Simplified estimation
      if (!IntentUtils.isEconomicallyFeasible(intent, estimatedGas)) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  async estimateCreationCost(params: CreateIntentParams): Promise<bigint> {
    // Simplified cost estimation using domain logic
    const intent = new IntentModel(params)

    // Base cost for intent creation
    let baseCost = 50000n // Base gas cost

    // Add cost per call
    baseCost += BigInt(intent.calls.length) * 10000n

    // Add cost per reward token
    baseCost += BigInt(intent.rewardTokens.length) * 5000n

    return baseCost
  }
}
