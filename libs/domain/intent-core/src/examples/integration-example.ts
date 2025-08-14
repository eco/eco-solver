/**
 * Example showing how to integrate the intent-core domain library
 * with existing services and controllers
 */

import { Injectable } from '@nestjs/common'
import { Hex } from 'viem'
import {
  IntentModel,
  IntentUtils,
  IntentCreationService,
  CreateIntentParams,
  IIntentFulfillmentService,
  FulfillmentRequest,
  FulfillmentResult,
} from '@eco/domain-intent-core'

/**
 * Example of how an existing service would be refactored
 * to use the domain library
 */
@Injectable()
export class RefactoredIntentService {
  constructor(
    private readonly intentCreationService: IntentCreationService,
    // Other domain services would be injected here
  ) {}

  /**
   * Create a new intent using domain services
   */
  async createIntent(params: CreateIntentParams): Promise<{
    hash: Hex
    jobId: string
    estimatedCost: bigint
  }> {
    // Use domain service for creation
    const hash = await this.intentCreationService.createIntent(params)

    // Use domain utilities for job ID generation
    const jobId = IntentUtils.generateJobId('intent-creation', hash, params.logIndex)

    // Get cost estimation
    const estimatedCost = await this.intentCreationService.estimateCreationCost(params)

    return {
      hash,
      jobId,
      estimatedCost,
    }
  }

  /**
   * Get intent information using domain model
   */
  async getIntentInfo(params: CreateIntentParams): Promise<{
    identifier: string
    canBeFulfilled: boolean
    timeToExpiry: number
    totalRewards: bigint
  }> {
    const intent = new IntentModel(params)

    return {
      identifier: IntentUtils.getIntentIdentifier(intent),
      canBeFulfilled: intent.canBeFulfilled(),
      timeToExpiry: IntentUtils.getTimeToExpiry(intent),
      totalRewards: intent.getTotalRewardValue(),
    }
  }

  /**
   * Validate an intent before processing
   */
  async validateIntentForProcessing(params: CreateIntentParams): Promise<boolean> {
    // Use domain validation service
    return this.intentCreationService.validateIntent(params)
  }
}

/**
 * Example controller integration
 */
export class IntentControllerExample {
  constructor(private readonly refactoredIntentService: RefactoredIntentService) {}

  async createIntentEndpoint(createParams: CreateIntentParams) {
    try {
      // Validate before creation
      const isValid = await this.refactoredIntentService.validateIntentForProcessing(createParams)
      if (!isValid) {
        return { error: 'Invalid intent parameters' }
      }

      // Create the intent
      const result = await this.refactoredIntentService.createIntent(createParams)

      // Get additional info for response
      const info = await this.refactoredIntentService.getIntentInfo(createParams)

      return {
        success: true,
        data: {
          ...result,
          ...info,
        },
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }
}
