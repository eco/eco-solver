// Export legacy static config function for backward compatibility
export * from './lib/solver-config'

// Export new eco-solver config system
export * from './lib/schemas/eco-solver.schema'
export type { CCTPLiFiConfig, CCTPV2Config, CCTPConfig } from './lib/schemas/eco-solver.schema'

// Export additional types needed by the app
export type TargetContractType = 'erc20' | 'erc721' | 'erc1155'
export type FeeAlgorithm = 'linear' | 'quadratic'
// Export the full target config type
export type { TargetConfig } from './lib/schemas/eco-solver.schema'
// Extract specific config types from the schema
export type QuotesConfig = {
  intentExecutionTypes?: string[]
}
export type GasEstimationsConfig = {
  fundFor?: bigint
  permit?: bigint
  permit2?: bigint
  defaultGasPriceGwei?: string
}
export type ServerConfig = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['server']
export type SolverRegistrationConfig = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['solverRegistrationConfig']
export type EverclearConfig = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['everclear']

// Add missing config type exports
export type IndexerConfig = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['indexer']
export type HyperlaneConfig =
  import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['hyperlane']
export type SendBatchConfig =
  import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['sendBatch']
export type WithdrawsConfig =
  import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['withdraws']
export type LiquidityManagerConfig = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType['liquidityManager']
export type { EcoIntentConfig } from './lib/schemas/eco-solver.schema'
export type CrowdLiquidityConfig = any // TODO: Define proper schema
export type AwsCredential = {
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  secretID?: string
}
export type FeeAlgorithmConfig = any // Legacy type
export type FeeConfigType = any // Legacy type
export type WhitelistFeeRecord = any // Legacy type
// Additional legacy types
export type KmsConfig = any
export type ProverEcoRoutesProverAppend = 'append'
export const ProverEcoRoutesProverAppend = 'append'
export type SafeType = any
export type EcoConfigType = import('./lib/schemas/eco-solver.schema').EcoSolverConfigType
export type FulfillmentEstimateConfig = any
export * from './lib/interfaces/config-source.interface'
export * from './lib/services/eco-solver-config.service'
export * from './lib/modules/eco-solver-config.module'
export * from './lib/providers/static-config.provider'
export * from './lib/providers/aws-secrets.provider'
export * from './lib/providers/env-override.provider'
export * from './lib/utils/chain-config.utils'

// Backward compatibility exports for @libs/config-core imports
// This allows existing imports to work without changes during migration
export { EcoSolverConfigService as EcoConfigService } from './lib/services/eco-solver-config.service'
export { EcoSolverConfigModule as EcoConfigModule } from './lib/modules/eco-solver-config.module'

// Legacy ConfigLoader compatibility
export class ConfigLoader {
  static getInstance(options?: any) {
    console.warn(
      '[DEPRECATED] ConfigLoader.getInstance is deprecated. Use EcoSolverConfigService instead.',
    )
    return new ConfigLoader()
  }

  static load(options?: any) {
    console.warn(
      '[DEPRECATED] ConfigLoader.load is deprecated. Use EcoSolverConfigService instead.',
    )
    const { getStaticSolverConfig } = require('./lib/solver-config')
    return getStaticSolverConfig()
  }

  static get(key: string) {
    console.warn('[DEPRECATED] ConfigLoader.get is deprecated. Use EcoSolverConfigService instead.')
    const { getStaticSolverConfig } = require('./lib/solver-config')
    const config = getStaticSolverConfig()
    return config[key]
  }

  static has(key: string): boolean {
    console.warn('[DEPRECATED] ConfigLoader.has is deprecated. Use EcoSolverConfigService instead.')
    const { getStaticSolverConfig } = require('./lib/solver-config')
    const config = getStaticSolverConfig()
    return key in config && config[key] !== undefined
  }

  static util = {
    getEnv(key: string) {
      console.warn('[DEPRECATED] ConfigLoader.util.getEnv is deprecated.')
      return process.env[key] || key.toLowerCase()
    }
  }

  // Instance methods for legacy compatibility
  load() {
    const { getStaticSolverConfig } = require('./lib/solver-config')
    return getStaticSolverConfig()
  }

  get<T>(key: string): T {
    const { getStaticSolverConfig } = require('./lib/solver-config')
    const config = getStaticSolverConfig()
    return config[key] as T
  }
}
