import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import { EventEmitter } from 'events'
import { ConfigurationCacheService } from './configuration-cache.service'

export class ConfigurationValidationError extends Error {
  constructor(message: string, public validationErrors: any) {
    super(message)
    this.name = 'ConfigurationValidationError'
  }
}

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: ConfigurationCacheService,
  ) {}

  // Type-safe configuration getter with Zod validation
  async get<T>(path: string, schema: z.ZodSchema<T>, defaultValue?: T): Promise<T> {
    const cacheKey = `config:${path}`

    // Try cache first (only for non-sensitive data)
    if (!this.cacheService['isSensitiveKey'](cacheKey)) {
      const cached = this.cacheService.get<T>(cacheKey)
      if (cached !== undefined) {
        return cached
      }
    }

    // Load and validate with Zod
    const rawConfig = this.configService.get(path, defaultValue)
    const result = schema.safeParse(rawConfig)

    if (!result.success) {
      throw new ConfigurationValidationError(
        `Invalid configuration for path: ${path}`,
        result.error.format(),
      )
    }

    const config = result.data

    // Cache validated config (only non-sensitive data)
    if (!this.cacheService['isSensitiveKey'](cacheKey)) {
      this.cacheService.set(cacheKey, config)
    }

    return config
  }

  // Hot reload with cache invalidation
  async reload(): Promise<void> {
    this.cacheService.invalidate('config:')
    this.logger.log('Configuration cache cleared and reloaded')
    // Emit event for subscribers
    EventEmitter.prototype.emit.call(this, 'config:reloaded')
  }

  // Synchronous version for simpler cases
  getSync<T>(path: string, schema: z.ZodSchema<T>, defaultValue?: T): T {
    const rawConfig = this.configService.get(path, defaultValue)
    const result = schema.safeParse(rawConfig)

    if (!result.success) {
      throw new ConfigurationValidationError(
        `Invalid configuration for path: ${path}`,
        result.error.format(),
      )
    }

    return result.data
  }
}