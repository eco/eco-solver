import { merge } from 'lodash'

// Static imports for all config files
import defaultConfig from '../../../../apps/eco-solver/config/default.js'
import developmentConfig from '../../../../apps/eco-solver/config/development.js'
import productionConfig from '../../../../apps/eco-solver/config/production.js'
import preproductionConfig from '../../../../apps/eco-solver/config/preproduction.js'
import stagingConfig from '../../../../apps/eco-solver/config/staging.js'
import testConfig from '../../../../apps/eco-solver/config/test.js'

export interface StaticConfigOptions {
  nodeEnv?: string
  nodeConfig?: string
}

/**
 * Static configuration loader that uses predefined imports instead of dynamic file loading.
 * This solves issues with bundled applications where dynamic require() calls fail.
 */
export class StaticConfigLoader {
  private static configCache = new Map<string, any>()

  // Predefined configuration mapping
  private static readonly configMappings = {
    default: defaultConfig,
    development: developmentConfig,
    production: productionConfig,
    preproduction: preproductionConfig,
    staging: stagingConfig,
    test: testConfig,
  } as const

  static load(options: StaticConfigOptions = {}): any {
    const env = options.nodeEnv || process.env.NODE_ENV || 'development'

    if (this.configCache.has(env) && !options.nodeConfig) {
      return this.configCache.get(env)
    }

    // Start with default configuration
    let config = this.deepMerge({}, this.configMappings.default || {})

    // Merge environment-specific configuration
    if (env !== 'default' && env in this.configMappings) {
      const envConfig = this.configMappings[env as keyof typeof this.configMappings]
      if (envConfig) {
        config = this.deepMerge(config, envConfig)
      }
    }

    // Apply NODE_CONFIG runtime overrides (for Docker containers)
    if (options.nodeConfig || process.env.NODE_CONFIG) {
      try {
        const runtimeConfig = JSON.parse(options.nodeConfig || process.env.NODE_CONFIG || '{}')
        config = this.deepMerge(config, runtimeConfig)
      } catch (error) {
        console.warn('Invalid NODE_CONFIG format:', (error as Error).message)
      }
    }

    // Process environment variable substitutions
    config = this.processEnvironmentVariables(config)

    if (!options.nodeConfig) {
      this.configCache.set(env, config)
    }

    return config
  }

  private static processEnvironmentVariables(obj: any): any {
    if (typeof obj === 'string') {
      // Handle environment variable substitution: ${VAR_NAME} or ${VAR_NAME:default}
      return obj.replace(/\$\{([^}]+)\}/g, (match, varExpression) => {
        const [varName, defaultValue] = varExpression.split(':')
        return process.env[varName] || defaultValue || match
      })
    } else if (Array.isArray(obj)) {
      return obj.map((item) => this.processEnvironmentVariables(item))
    } else if (typeof obj === 'object' && obj !== null) {
      const result: any = {}
      for (const key in obj) {
        result[key] = this.processEnvironmentVariables(obj[key])
      }
      return result
    }
    return obj
  }

  private static deepMerge(target: any, source: any): any {
    return merge({}, target, source)
  }

  static get<T = any>(path?: string, defaultValue?: T): T {
    const config = this.load()

    if (!path) {
      return config as T
    }

    const value = this.getNestedValue(config, path)
    return value !== undefined ? value : (defaultValue as T)
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined
    }, obj)
  }

  static has(path: string): boolean {
    return this.get(path) !== undefined
  }

  static reload(options?: StaticConfigOptions): void {
    this.configCache.clear()
    this.load(options)
  }

  // Utility methods for compatibility with npm config API
  static util = {
    getEnv: (varName: string) => process.env[varName] || 'development',
  }
}