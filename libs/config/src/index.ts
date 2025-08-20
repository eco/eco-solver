// Export all core configuration utilities
export * from './lib/services/configuration.service'
export * from './lib/services/configuration-cache.service'
export * from './lib/config.module'

// Export eco-solver specific configuration utilities
export * from './lib/eco-config.service'
export * from './lib/eco-config.module'
export * from './lib/config-loader'
export * from './lib/static-config-loader'
export * from './lib/eco-solver-config'

// Export specific types to avoid conflicts
export type { 
  EcoConfigType, 
  Network, 
  AnalyticsConfig as EcoAnalyticsConfig,
  Strategy as EcoStrategy,
  Solver,
  IntentSource
} from './lib/eco-config.types'
