export interface ErrorLike {
  toString(): string
  message: string
}

/**
 * Basic error class for shared use in libs
 * Apps can extend this with more specific error methods
 */
export class EcoError extends Error {
  static IntentSourceDataInvalidParams = new EcoError('Intent source data has invalid parameters')
  static IntentSourceTargetConfigNotFound(target: string) {
    return new EcoError(`Intent source target config not found for ${target}`)
  }
  static AlchemyUnsupportedNetworkError(network: string) {
    return new EcoError(`App does not support network ${network}, check your config file`)
  }
  static IntentSourceDataNotFound(intentHash: string) {
    return new EcoError(`Could not find data for intent hash ${intentHash}`)
  }
  static CrowdLiquidityRewardNotEnough(intentHash: string) {
    return new EcoError(`Crowd liquidity reward not enough for intent ${intentHash}`)
  }
  static IntentSourceUnsupportedTargetType(targetType: string) {
    return new EcoError(`Intent source unsupported target type: ${targetType}`)
  }
  
  static logErrorWithStack(message: string, context?: string, ...args: any[]) {
    console.error(`[EcoError] ${context || ''}: ${message}`, ...args)
  }
}
