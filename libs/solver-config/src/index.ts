// Export legacy static config function for backward compatibility
export * from './lib/solver-config'

// Export new eco-solver config system
export * from './lib/schemas/eco-solver.schema'
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
    return {
      load: () => {
        const { getStaticSolverConfig } = require('./lib/solver-config')
        return getStaticSolverConfig()
      },
    }
  }

  static load(options?: any) {
    console.warn(
      '[DEPRECATED] ConfigLoader.load is deprecated. Use EcoSolverConfigService instead.',
    )
    const { getStaticSolverConfig } = require('./lib/solver-config')
    return getStaticSolverConfig()
  }
}
