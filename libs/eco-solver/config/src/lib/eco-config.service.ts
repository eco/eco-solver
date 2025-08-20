import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConfigLoader } from './config-loader'
import { ConfigurationService } from '@mono-solver/config-core'
import { 
  ServerConfigSchema, 
  DatabaseConfigSchema, 
  AwsConfigSchema,
  LoggingConfigSchema,
  RedisConfigSchema,
  IntentConfigSchema 
} from '@mono-solver/schemas'

export interface DatabaseConfig {
  type: string
  url: string
  options?: Record<string, any>
}

export interface ServerConfig {
  port: number
  host: string
}

export interface AwsConfig {
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  secrets?: Array<{
    region: string
    secretID: string
  }>
}

export interface LoggingConfig {
  level: string
  usePino: boolean
  pinoConfig?: any
}

export interface RedisConfig {
  options: any
  redlockSettings: any
  jobs: any
}

export interface IntentConfig {
  defaultFee: any
  proofs: any
  intentFundedRetries: number
  intentFundedRetryDelayMs: number
  defaultGasOverhead: number
}

@Injectable()
export class EcoConfigService {
  private readonly logger = new Logger(EcoConfigService.name)
  private configLoader: ConfigLoader

  constructor(
    private configService: ConfigService,
    private readonly modernConfigService?: ConfigurationService // Optional for gradual migration
  ) {
    this.configLoader = ConfigLoader.getInstance()
    this.validateConfiguration()
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    // Try modern configuration service first
    if (this.modernConfigService) {
      try {
        const modernConfig = this.modernConfigService.getSync('server', ServerConfigSchema)
        return {
          port: modernConfig.port,
          host: modernConfig.host || '0.0.0.0', // Fallback for optional host
        }
      } catch (error) {
        this.logger.warn('Modern config failed, falling back to legacy:', error.message)
      }
    }
    
    // Fallback to legacy configuration
    return {
      port: this.get<number>('server.port', 3000),
      host: this.get<string>('server.host', '0.0.0.0'),
    }
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    // Try modern configuration service first
    if (this.modernConfigService) {
      try {
        const modernConfig = this.modernConfigService.getSync('database', DatabaseConfigSchema)
        // Map modern schema to legacy interface
        return {
          type: 'mongodb', // Fixed type as modern schema doesn't expose this
          url: `mongodb://${modernConfig.username}:${modernConfig.password}@${modernConfig.host}:${modernConfig.port}/${modernConfig.database}`,
          options: modernConfig.pool || {},
        }
      } catch (error) {
        this.logger.warn('Modern database config failed, falling back to legacy:', error.message)
      }
    }
    
    // Fallback to legacy configuration
    return {
      type: this.get<string>('database.type', 'mongodb'),
      url: this.get<string>('database.url'),
      options: this.get<Record<string, any>>('database.options', {}),
    }
  }

  /**
   * Get AWS configuration
   */
  getAwsConfig(): AwsConfig {
    return {
      region: this.get<string>('aws.region', 'us-east-1'),
      accessKeyId: this.get<string>('aws.accessKeyId'),
      secretAccessKey: this.get<string>('aws.secretAccessKey'),
      secrets: this.get<Array<any>>('aws', []),
    }
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return {
      level: this.get<string>('logger.pinoConfig.pinoHttp.level', 'info'),
      usePino: this.get<boolean>('logger.usePino', true),
      pinoConfig: this.get<any>('logger.pinoConfig'),
    }
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig(): RedisConfig {
    return {
      options: this.get<any>('redis.options', {}),
      redlockSettings: this.get<any>('redis.redlockSettings', {}),
      jobs: this.get<any>('redis.jobs', {}),
    }
  }

  /**
   * Get Intent configuration
   */
  getIntentConfig(): IntentConfig {
    return {
      defaultFee: this.get<any>('intentConfigs.defaultFee'),
      proofs: this.get<any>('intentConfigs.proofs'),
      intentFundedRetries: this.get<number>('intentConfigs.intentFundedRetries', 3),
      intentFundedRetryDelayMs: this.get<number>('intentConfigs.intentFundedRetryDelayMs', 500),
      defaultGasOverhead: this.get<number>('intentConfigs.defaultGasOverhead', 145000),
    }
  }

  /**
   * Get configuration value by path
   * @deprecated Use modernConfigService.get() with schema validation instead
   */
  get<T = any>(path: string, defaultValue?: T): T {
    // Log deprecation warning occasionally (not on every call to avoid spam)
    if (Math.random() < 0.01) { // 1% chance to log warning
      this.logger.warn(`[DEPRECATED] Use modernConfigService.get() instead of legacy get('${path}')`)
    }

    // First try NestJS ConfigService for environment variables
    const envValue = this.configService.get<T>(path)
    if (envValue !== undefined) {
      return envValue
    }

    // Fallback to config loader
    const configValue = ConfigLoader.get<T>(path)
    return configValue !== undefined ? configValue : (defaultValue as T)
  }

  /**
   * Check if configuration path exists
   */
  has(path: string): boolean {
    return this.configService.get(path) !== undefined || ConfigLoader.has(path)
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, any> {
    return ConfigLoader.get()
  }

  /**
   * Reload configuration
   */
  async reload(): Promise<void> {
    // Try modern configuration service first
    if (this.modernConfigService) {
      try {
        await this.modernConfigService.reload()
        this.logger.log('Modern configuration reloaded successfully')
        return
      } catch (error) {
        this.logger.warn('Modern config reload failed, falling back to legacy:', error.message)
      }
    }
    
    // Fallback to legacy configuration reload
    ConfigLoader.reload()
    this.validateConfiguration()
    this.logger.log('Legacy configuration reloaded successfully')
  }

  /**
   * Validate critical configuration values
   */
  private validateConfiguration(): void {
    const requiredConfigs = [
      // Basic validation - most configs come from AWS Secrets Manager
      'aws',
    ]

    const missingConfigs = requiredConfigs.filter((config) => !this.has(config))

    if (missingConfigs.length > 0) {
      const message = `Missing required configuration: ${missingConfigs.join(', ')}`
      this.logger.warn(message)
    }

    this.logger.log('Configuration validation completed')
  }

  /**
   * Get configuration for specific service
   */
  getServiceConfig(serviceName: string): Record<string, any> {
    return this.get<Record<string, any>>(`services.${serviceName}`, {})
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(featureName: string): boolean {
    return this.get<boolean>(`features.${featureName}`, false)
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || 'development'
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production'
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === 'development'
  }

  /**
   * Get CCTP configuration
   */
  getCctpConfig(): any {
    return this.get<any>('CCTP', {})
  }

  /**
   * Get CCTP V2 configuration
   */
  getCctpV2Config(): any {
    return this.get<any>('CCTPV2', {})
  }

  /**
   * Get Hyperlane configuration
   */
  getHyperlaneConfig(): any {
    return this.get<any>('hyperlane', {})
  }

  /**
   * Get Squid configuration
   */
  getSquidConfig(): any {
    return this.get<any>('squid', {})
  }

  /**
   * Get Everclear configuration
   */
  getEverclearConfig(): any {
    return this.get<any>('everclear', {})
  }

  /**
   * Get indexer configuration
   */
  getIndexerConfig(): any {
    return this.get<any>('indexer', {})
  }

  /**
   * Get whitelist configuration
   */
  getWhitelistConfig(): Record<string, any> {
    return this.get<Record<string, any>>('whitelist', {})
  }

  /**
   * Get gas estimation configuration
   */
  getGasEstimationConfig(): any {
    return this.get<any>('gasEstimations', {})
  }

  /**
   * Static method for compile-time config access (preserves existing usage)
   */
  static getStaticConfig(path?: string): any {
    const config = ConfigLoader.load()
    return path ? ConfigLoader.get(path) : config
  }

  /**
   * Utility methods to maintain compatibility with npm config API
   */
  static util = {
    getEnv: (varName: string) => process.env[varName] || 'development',
  }
}
