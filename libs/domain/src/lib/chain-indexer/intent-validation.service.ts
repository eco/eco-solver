import { Injectable, Logger } from '@nestjs/common'
import { IntentFundedLog, EcoLogMessage, EcoError } from '@libs/shared'
import { EcoConfigService } from '@libs/integrations'

@Injectable()
export class IntentValidationService {
  private readonly logger = new Logger(IntentValidationService.name)

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  /**
   * Validates if an intent hash corresponds to an intent owned by this solver
   * @param intentHash The intent hash to validate
   * @returns True if this is our intent, false otherwise
   */
  async isOurIntent(intentHash: string): Promise<boolean> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'validating intent ownership',
          properties: { intentHash }
        })
      )

      // Business logic to determine intent ownership
      // This would typically check against stored intents or solver configuration
      const solverConfig = this.ecoConfigService.getSolverConfig()
      
      // Placeholder implementation - replace with actual business logic
      if (!intentHash || intentHash.length !== 66) {
        return false
      }

      // Additional validation logic would go here
      return true
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'intent validation failed',
          error: EcoError.getErrorObject(error),
          properties: { intentHash }
        })
      )
      return false
    }
  }

  /**
   * Validates intent ownership from log data
   * @param log The intent funded log to validate
   * @returns True if this log represents our intent
   */
  async validateIntentOwnership(log: IntentFundedLog): Promise<boolean> {
    if (!log.args?.intentHash) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'intent log missing hash',
          properties: { log }
        })
      )
      return false
    }

    return this.isOurIntent(log.args.intentHash)
  }

  /**
   * Validates if a chain ID is supported by this solver
   * @param chainId The chain ID to validate
   * @returns True if chain is supported
   */
  validateChainSupport(chainId: number): boolean {
    const supportedChains = this.ecoConfigService.getSupportedChainIds()
    return supportedChains.includes(chainId)
  }

  /**
   * Validates intent relevance based on business rules
   * @param intent The intent data to validate
   * @returns True if intent is relevant for processing
   */
  determineIntentRelevance(intent: any): boolean {
    if (!intent) {
      return false
    }

    // Validate required fields
    if (!intent.hash || !intent.creator || !intent.destination) {
      return false
    }

    // Validate destination chain is supported
    if (!this.validateChainSupport(Number(intent.destination))) {
      return false
    }

    // Additional business rule validation
    return true
  }
}