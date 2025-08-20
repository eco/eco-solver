import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { merge } from 'lodash'
import { StaticConfigLoader } from './static-config-loader'

export interface ConfigEnvironments {
  default: any
  development?: any
  production?: any
  preproduction?: any
  staging?: any
  test?: any
}

export interface ConfigOptions {
  configDir?: string
  nodeEnv?: string
  nodeConfig?: string
}

export class ConfigLoader {
  private static configCache = new Map<string, any>()
  private static configDir: string

  static getInstance(options?: ConfigOptions): ConfigLoader {
    return new ConfigLoader(options)
  }

  constructor(options: ConfigOptions = {}) {
    ConfigLoader.configDir = options.configDir || this.getDefaultConfigDir()
  }

  private getDefaultConfigDir(): string {
    // Try to determine if we're running from dist or source
    const cwd = process.cwd()
    if (cwd.includes('/dist/')) {
      // Running from dist, config should be at dist/apps/eco-solver/config
      return join(cwd, 'apps/eco-solver/config')
    }
    // Running from source, config should be at apps/eco-solver/config
    return join(cwd, 'apps/eco-solver/config')
  }

  static load(options: ConfigOptions = {}): any {
    const env = options.nodeEnv || process.env.NODE_ENV || 'development'

    if (this.configCache.has(env) && !options.nodeConfig) {
      return this.configCache.get(env)
    }

    // Try static loading first (for bundled apps)
    try {
      return StaticConfigLoader.load({
        nodeEnv: options.nodeEnv,
        nodeConfig: options.nodeConfig,
      })
    } catch (staticError) {
      console.warn('Static config loading failed, falling back to dynamic loading:', (staticError as Error).message)
    }

    // Fallback to dynamic file loading (original behavior)
    const configDir = options.configDir || new ConfigLoader().getDefaultConfigDir()

    // Load base configuration (try .js first, fallback to .ts)
    let config = this.loadConfigFile(join(configDir, 'default.js')) || 
                 this.loadConfigFile(join(configDir, 'default.ts')) || {}

    // Load environment-specific configuration
    if (env !== 'default') {
      const envConfig = this.loadConfigFile(join(configDir, `${env}.js`)) ||
                       this.loadConfigFile(join(configDir, `${env}.ts`))
      if (envConfig) {
        config = this.deepMerge(config, envConfig)
      }
    }

    // Load local configuration override (local.js/local.ts) - highest priority
    const localConfig = this.loadConfigFile(join(configDir, 'local.js')) ||
                       this.loadConfigFile(join(configDir, 'local.ts'))
    if (localConfig) {
      config = this.deepMerge(config, localConfig)
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

  private static loadConfigFile(filePath: string): any {
    if (!existsSync(filePath)) {
      return null
    }

    try {
      // Clear require cache to allow hot reloading
      delete require.cache[require.resolve(filePath)]
      const configModule = require(filePath)
      return configModule.default || configModule
    } catch (error) {
      console.warn(`Failed to load config file ${filePath}:`, (error as Error).message)
      return null
    }
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

  static reload(options?: ConfigOptions): void {
    this.configCache.clear()
    this.load(options)
  }

  // Utility methods for compatibility with npm config API
  static util = {
    getEnv: (varName: string) => process.env[varName] || 'development',
  }

  // Instance methods that delegate to static methods
  load(options?: ConfigOptions): any {
    return ConfigLoader.load(options)
  }

  get<T = any>(path?: string, defaultValue?: T): T {
    return ConfigLoader.get(path, defaultValue)
  }

  has(path: string): boolean {
    return ConfigLoader.has(path)
  }

  reload(options?: ConfigOptions): void {
    ConfigLoader.reload(options)
  }
}
