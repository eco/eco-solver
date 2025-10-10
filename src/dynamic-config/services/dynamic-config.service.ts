import { ConfigurationDocument } from '@/dynamic-config/schemas/configuration.schema'
import {
  ConfigurationFilter,
  PaginationOptions,
  PaginatedResult,
  CreateConfigurationDTO,
  UpdateConfigurationDTO,
} from '@/dynamic-config/interfaces/configuration-repository.interface'
import { DynamicConfigAuditService } from '@/dynamic-config/services/dynamic-config-audit.service'
import { DynamicConfigRepository } from '@/dynamic-config/repositories/dynamic-config.repository'
import { DynamicConfigSanitizerService } from '@/dynamic-config/services/dynamic-config-sanitizer.service'
import { DynamicConfigValidatorService } from '@/dynamic-config/services/dynamic-config-validator.service'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { Injectable, Logger, OnModuleInit, Inject, OnModuleDestroy } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

export interface ConfigurationChangeEvent {
  key: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  oldValue?: any
  newValue?: any
  userId?: string
  userAgent?: string
  ipAddress?: string
  timestamp: Date
}

export interface CachedConfiguration {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  isRequired: boolean
  isSecret: boolean
  description?: string
  lastModified: Date
}

@Injectable()
export class DynamicConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DynamicConfigService.name)
  private readonly configCache = new Map<string, CachedConfiguration>()

  private cacheInitialized = false
  private readonly CACHE_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes (fallback polling)
  private readonly CACHE_REFRESH_INTERVAL_WITH_CHANGE_STREAMS = 30 * 60 * 1000 // 30 minutes (reduced polling when change streams work)
  private cacheRefreshTimer?: NodeJS.Timeout
  private changeStream?: any
  private changeStreamEnabled = process.env.MONGODB_CHANGE_STREAMS_ENABLED !== 'false' // Default enabled
  private changeStreamActive = false // Track if change streams are working

  constructor(
    @Inject(DynamicConfigRepository) private readonly configRepository: DynamicConfigRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(DynamicConfigValidatorService)
    private readonly validator: DynamicConfigValidatorService,
    @Inject(DynamicConfigAuditService) private readonly auditService: DynamicConfigAuditService,
    @Inject(DynamicConfigSanitizerService)
    private readonly sanitizer: DynamicConfigSanitizerService,
    @InjectModel('Configuration') private readonly configModel: Model<ConfigurationDocument>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing ConfigurationService...')

    // Debug: Check if all required dependencies are properly injected
    const dependencies = {
      configRepository: !!this.configRepository,
      eventEmitter: !!this.eventEmitter, // Optional
      validator: !!this.validator,
      auditService: !!this.auditService,
      sanitizer: !!this.sanitizer,
    }

    this.logger.log('Constructor dependencies status:', dependencies)

    // Only check required dependencies (eventEmitter is optional)
    const requiredDeps = ['configRepository', 'validator', 'auditService', 'sanitizer']
    const missingDeps = requiredDeps.filter((dep) => !dependencies[dep])

    if (missingDeps.length > 0) {
      this.logger.error(`Missing required dependencies: ${missingDeps.join(', ')}`)
      throw new Error(`Dependency injection failed for: ${missingDeps.join(', ')}`)
    }

    if (!this.eventEmitter) {
      this.logger.warn('EventEmitter2 not available - configuration change events will be skipped')
    }

    // Register common schemas
    this.validator.registerCommonSchemas()

    await this.loadConfigurationsIntoCache()

    // Only start cache refresh timer and change streams if EventEmitter is available (indicates full app context)
    if (this.eventEmitter) {
      // Start MongoDB Change Streams for real-time updates
      if (this.changeStreamEnabled) {
        await this.startChangeStreamMonitoring()
      }

      // Start cache refresh timer with appropriate interval based on change stream status
      this.startCacheRefreshTimer()
    } else {
      this.logger.log('Cache refresh timer and change streams skipped (CLI context)')
    }

    this.logger.log('ConfigurationService initialized successfully')
  }

  /**
   * Get a configuration value by key with caching
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Try cache first
    if (this.cacheInitialized && this.configCache.has(key)) {
      const cached = this.configCache.get(key)!
      this.logger.debug(`Configuration retrieved from cache: ${key}`)
      return (cached.isSecret ? this.maskSecretValue() : cached.value) as T
    }

    // Fallback to database
    this.logger.debug(`Configuration not in cache, fetching from database: ${key}`)
    const config = await this.configRepository.findByKey(key)

    if (config) {
      // Update cache
      this.updateCacheEntry(config)
      return (config.isSecret ? this.maskSecretValue() : config.value) as T
    }

    return null
  }

  /**
   * Get a configuration value with a default fallback
   */
  async getWithDefault<T = any>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key)
    return value !== null ? value : defaultValue
  }

  /**
   * Get all configurations with filtering and pagination
   */
  async getAll(
    filter?: ConfigurationFilter,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<CachedConfiguration>> {
    const dbResult = await this.configRepository.findAll(filter, pagination)

    // Convert to cached format and mask secrets
    const data = dbResult.data.map((config) => this.convertToCachedFormat(config))

    return {
      data,
      pagination: dbResult.pagination,
    }
  }

  /**
   * Create a new configuration with user context
   */
  async create(
    data: CreateConfigurationDTO,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<ConfigurationDocument> {
    this.logger.log(`Creating configuration: ${data.key}`)

    // Validate and sanitize configuration key
    const keyValidation = this.sanitizer.validateConfigurationKey(data.key)
    if (!keyValidation.isValid) {
      throw new Error(`Invalid configuration key: ${keyValidation.error}`)
    }

    // Sanitize configuration value
    const sanitizedValue = this.sanitizer.sanitizeValue(data.value)

    // Auto-detect sensitive values if not explicitly marked
    if (!data.isSecret && this.sanitizer.detectSensitiveValue(data.key, sanitizedValue)) {
      this.logger.warn(`Auto-detected sensitive value for key '${data.key}', marking as secret`)
      data.isSecret = true
    }

    // Create sanitized data object
    const sanitizedData = {
      ...data,
      value: sanitizedValue,
    }

    // Validate configuration value
    const validationResult = await this.validator.validateConfiguration(
      sanitizedData.key,
      sanitizedData.value,
    )
    if (!validationResult.isValid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`)
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      this.logger.warn(
        `Configuration warnings for '${sanitizedData.key}': ${validationResult.warnings.join(', ')}`,
      )
    }

    const config = await this.configRepository.create(sanitizedData)

    // Update cache
    this.updateCacheEntry(config)

    // Emit change event
    this.emitConfigurationChange({
      key: data.key,
      operation: 'CREATE',
      newValue: data.value,
      userId,
      userAgent,
      ipAddress,
      timestamp: new Date(),
    })

    this.logger.log(`Configuration created successfully: ${data.key}`)
    return config
  }

  /**
   * Update an existing configuration with user context
   */
  async update(
    key: string,
    data: UpdateConfigurationDTO,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<ConfigurationDocument | null> {
    this.logger.log(`Updating configuration: ${key}`)

    // Sanitize and validate configuration value if provided
    const sanitizedData = { ...data }
    if (data.value !== undefined) {
      // Sanitize the value
      sanitizedData.value = this.sanitizer.sanitizeValue(data.value)

      // Auto-detect sensitive values if not explicitly marked
      if (data.isSecret === undefined) {
        const oldConfig = await this.configRepository.findByKey(key)
        if (!oldConfig?.isSecret && this.sanitizer.detectSensitiveValue(key, sanitizedData.value)) {
          this.logger.warn(`Auto-detected sensitive value for key '${key}', marking as secret`)
          sanitizedData.isSecret = true
        }
      }

      const validationResult = await this.validator.validateConfiguration(key, sanitizedData.value)
      if (!validationResult.isValid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`)
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        this.logger.warn(
          `Configuration warnings for '${key}': ${validationResult.warnings.join(', ')}`,
        )
      }
    }

    // Get old value for audit
    const oldConfig = await this.configRepository.findByKey(key)
    const oldValue = oldConfig?.value

    const updatedConfig = await this.configRepository.update(key, sanitizedData)

    if (updatedConfig) {
      // Update cache
      this.updateCacheEntry(updatedConfig)

      // Emit change event
      this.emitConfigurationChange({
        key,
        operation: 'UPDATE',
        oldValue,
        newValue: data.value,
        userId,
        userAgent,
        ipAddress,
        timestamp: new Date(),
      })

      this.logger.log(`Configuration updated successfully: ${key}`)
    } else {
      this.logger.warn(`Configuration not found for update: ${key}`)
    }

    return updatedConfig
  }

  /**
   * Delete a configuration with user context
   */
  async delete(
    key: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<boolean> {
    this.logger.log(`Deleting configuration: ${key}`)

    // Get old value for audit
    const oldConfig = await this.configRepository.findByKey(key)
    const oldValue = oldConfig?.value

    // Check if configuration is required
    if (oldConfig?.isRequired) {
      throw new Error(`Cannot delete required configuration: ${key}`)
    }

    const deleted = await this.configRepository.delete(key)

    if (deleted) {
      // Remove from cache
      this.configCache.delete(key)

      // Emit change event
      this.emitConfigurationChange({
        key,
        operation: 'DELETE',
        oldValue,
        userId,
        userAgent,
        ipAddress,
        timestamp: new Date(),
      })

      this.logger.log(`Configuration deleted successfully: ${key}`)
    } else {
      this.logger.warn(`Configuration not found for deletion: ${key}`)
    }

    return deleted
  }

  /**
   * Check if a configuration exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.cacheInitialized && this.configCache.has(key)) {
      return true
    }
    return await this.configRepository.exists(key)
  }

  /**
   * Get all required configurations
   */
  async getRequired(): Promise<CachedConfiguration[]> {
    const configs = await this.configRepository.findRequired()
    return configs.map((config) => this.convertToCachedFormat(config))
  }

  /**
   * Get all secret configurations (values will be masked)
   */
  async getSecrets(): Promise<CachedConfiguration[]> {
    const configs = await this.configRepository.findSecrets()
    return configs.map((config) => this.convertToCachedFormat(config))
  }

  /**
   * Find missing required configurations
   */
  async findMissingRequired(requiredKeys: string[]): Promise<string[]> {
    return await this.configRepository.findMissingRequired(requiredKeys)
  }

  /**
   * Get configuration statistics
   */
  async getStatistics() {
    const dbStats = await this.configRepository.getStatistics()

    return {
      ...dbStats,
      cache: {
        size: this.configCache.size,
        initialized: this.cacheInitialized,
        lastRefresh: new Date(),
      },
    }
  }

  /**
   * Refresh the configuration cache
   */
  async refreshCache(): Promise<void> {
    this.logger.log('Refreshing configuration cache...')
    await this.loadConfigurationsIntoCache()
    this.logger.log('Configuration cache refreshed successfully')
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.logger.log('Clearing configuration cache...')
    this.configCache.clear()
    this.cacheInitialized = false
    this.logger.log('Configuration cache cleared')
  }

  /**
   * Get cache status and metrics
   */
  getCacheMetrics() {
    return {
      size: this.configCache.size,
      initialized: this.cacheInitialized,
      keys: Array.from(this.configCache.keys()),
      memoryUsage: process.memoryUsage(),
    }
  }

  /**
   * Health check for the configuration service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check repository health
      const repoHealthy = await this.configRepository.healthCheck()

      // Check cache status
      const cacheHealthy = this.cacheInitialized

      return repoHealthy && cacheHealthy
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return false
    }
  }

  /**
   * Load all configurations into cache
   */
  private async loadConfigurationsIntoCache(): Promise<void> {
    try {
      const allConfigs = await this.configRepository.findAll()

      this.configCache.clear()

      for (const config of allConfigs.data) {
        this.updateCacheEntry(config)
      }

      this.cacheInitialized = true
      this.logger.log(`Loaded ${allConfigs.data.length} configurations into cache`)
    } catch (error) {
      this.logger.error('Failed to load configurations into cache:', error)
      this.cacheInitialized = false
      throw error
    }
  }

  /**
   * Update a single cache entry
   */
  private updateCacheEntry(config: ConfigurationDocument): void {
    const cached: CachedConfiguration = {
      key: config.key,
      value: config.value,
      type: config.type,
      isRequired: config.isRequired,
      isSecret: config.isSecret,
      description: config.description,
      lastModified: config.updatedAt,
    }

    this.configCache.set(config.key, cached)
  }

  /**
   * Convert database document to cached format
   */
  private convertToCachedFormat(config: ConfigurationDocument): CachedConfiguration {
    return {
      key: config.key,
      value: config.isSecret ? this.maskSecretValue() : config.value,
      type: config.type,
      isRequired: config.isRequired,
      isSecret: config.isSecret,
      description: config.description,
      lastModified: config.updatedAt,
    }
  }

  /**
   * Mask secret values for security
   */
  private maskSecretValue(): string {
    return '***MASKED***'
  }

  /**
   * Emit configuration change event
   */
  private emitConfigurationChange(event: ConfigurationChangeEvent): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit('configuration.changed', event)
      this.logger.debug(`Configuration change event emitted: ${event.key} - ${event.operation}`)
    } else {
      this.logger.debug(
        `Configuration change event skipped (no eventEmitter): ${event.key} - ${event.operation}`,
      )
    }
  }

  /**
   * Validate a configuration value without saving
   */
  async validateValue(
    key: string,
    value: any,
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    return await this.validator.validateConfiguration(key, value)
  }

  /**
   * Get configuration audit history
   */
  async getAuditHistory(configKey: string, limit: number = 50, offset: number = 0) {
    return await this.auditService.getConfigurationHistory(configKey, limit, offset)
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit: number = 50, offset: number = 0) {
    return await this.auditService.getUserActivity(userId, limit, offset)
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate?: Date, endDate?: Date) {
    return await this.auditService.getAuditStatistics(startDate, endDate)
  }

  /**
   * Handle configuration change events for audit logging
   */
  @OnEvent('configuration.changed')
  private async handleConfigurationChanged(event: ConfigurationChangeEvent): Promise<void> {
    try {
      await this.auditService.handleConfigurationChange(event)
    } catch (error) {
      this.logger.error('Failed to handle configuration change event:', error)
    }
  }

  /**
   * Start periodic cache refresh timer with appropriate interval
   */
  private startCacheRefreshTimer(): void {
    // Choose interval based on change stream availability
    const interval = this.changeStreamActive
      ? this.CACHE_REFRESH_INTERVAL_WITH_CHANGE_STREAMS
      : this.CACHE_REFRESH_INTERVAL

    this.cacheRefreshTimer = setInterval(async () => {
      try {
        await this.refreshCache()
      } catch (error) {
        this.logger.error('Periodic cache refresh failed:', error)
      }
    }, interval)

    const intervalMinutes = Math.round(interval / 60000)
    const mode = this.changeStreamActive ? 'with change streams' : 'fallback mode'
    this.logger.log(`Cache refresh timer started (${intervalMinutes}min interval, ${mode})`)
  }

  /**
   * Restart cache refresh timer with updated interval
   */
  private restartCacheRefreshTimer(): void {
    // Stop existing timer
    this.stopCacheRefreshTimer()

    // Start with new interval
    this.startCacheRefreshTimer()
  }

  /**
   * Stop the cache refresh timer (useful for cleanup)
   */
  stopCacheRefreshTimer(): void {
    if (this.cacheRefreshTimer) {
      clearInterval(this.cacheRefreshTimer)
      this.cacheRefreshTimer = undefined
      this.logger.log('Cache refresh timer stopped')
    }
  }

  /**
   * Start MongoDB Change Streams monitoring for real-time configuration updates
   */
  private async startChangeStreamMonitoring(): Promise<void> {
    try {
      // Create change stream with pipeline to filter only configuration changes
      const pipeline = [
        {
          $match: {
            'fullDocument.key': { $exists: true },
            operationType: { $in: ['insert', 'update', 'delete'] },
          },
        },
      ]

      this.changeStream = this.configModel.watch(pipeline, {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable',
      })

      if (this.changeStream) {
        // Handle change stream events
        this.changeStream.on('change', (change: any) => {
          this.handleChangeStreamEvent(change)
        })

        // Handle change stream errors
        this.changeStream.on('error', (error) => {
          this.logger.error('MongoDB Change Stream error:', error)
          this.handleChangeStreamError(error)
        })

        // Handle change stream close
        this.changeStream.on('close', () => {
          this.logger.warn('MongoDB Change Stream closed')
        })
      }

      this.changeStreamActive = true
      this.logger.log('MongoDB Change Streams monitoring started successfully')

      // Restart cache refresh timer with longer interval since we have real-time updates
      this.restartCacheRefreshTimer()
    } catch (error) {
      this.changeStreamActive = false
      this.logger.error('Failed to start MongoDB Change Streams:', error)
      this.logger.log('Falling back to polling-only mode')

      // Ensure we have frequent polling as fallback
      this.restartCacheRefreshTimer()
    }
  }

  /**
   * Handle MongoDB Change Stream events
   */
  private handleChangeStreamEvent(change: any): void {
    try {
      const operationType = change.operationType
      const fullDocument = change.fullDocument as any
      const fullDocumentBeforeChange = change.fullDocumentBeforeChange as any

      // Extract configuration key and values
      const key = fullDocument?.key || fullDocumentBeforeChange?.key
      const newValue = fullDocument?.value
      const oldValue = fullDocumentBeforeChange?.value

      if (!key) {
        this.logger.warn('Change stream event missing configuration key:', change)
        return
      }

      // Create configuration change event
      const event: ConfigurationChangeEvent = {
        key,
        operation: operationType.toUpperCase() as 'CREATE' | 'UPDATE' | 'DELETE',
        newValue,
        oldValue,
        timestamp: new Date(),
        userId: 'change-stream', // Indicates this came from change stream
      }

      this.logger.debug(`Change stream detected: ${key} - ${event.operation}`)

      // Update local cache based on operation type
      this.updateCacheFromChangeStream(event)

      // Emit event for other services (like EcoConfigService)
      if (this.eventEmitter) {
        this.eventEmitter.emit('configuration.changed', event)
      }
    } catch (error) {
      this.logger.error('Error handling change stream event:', error)
    }
  }

  /**
   * Infer configuration type from value
   */
  private inferConfigurationType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' {
    if (Array.isArray(value)) {
      return 'array'
    }
    if (value === null || value === undefined) {
      return 'string'
    }
    if (typeof value === 'object') {
      return 'object'
    }
    return typeof value as 'string' | 'number' | 'boolean'
  }

  /**
   * Update local cache based on change stream event
   */
  private updateCacheFromChangeStream(event: ConfigurationChangeEvent): void {
    try {
      if (event.operation === 'DELETE') {
        // Remove from cache
        this.configCache.delete(event.key)
        this.logger.debug(`Cache updated: removed ${event.key}`)
      } else {
        // Add or update cache
        const cachedConfig: CachedConfiguration = {
          key: event.key,
          value: event.newValue,
          type: this.inferConfigurationType(event.newValue),
          isRequired: false, // Will be determined by validation
          isSecret: this.sanitizer.detectSensitiveValue(event.key, event.newValue),
          lastModified: event.timestamp,
        }

        this.configCache.set(event.key, cachedConfig)
        const sanitizedValue = cachedConfig.isSecret ? '[REDACTED]' : event.newValue
        this.logger.debug(`Cache updated: ${event.key} = ${sanitizedValue}`)
      }
    } catch (error) {
      this.logger.error('Error updating cache from change stream:', error)
    }
  }

  /**
   * Handle change stream errors with reconnection logic
   */
  private handleChangeStreamError(error: any): void {
    this.logger.error('Change stream error occurred:', error)

    // Mark change streams as inactive
    this.changeStreamActive = false

    // Close existing change stream
    if (this.changeStream) {
      this.changeStream.close()
      this.changeStream = undefined
    }

    // Switch to more frequent polling immediately
    this.restartCacheRefreshTimer()
    this.logger.log('Switched to frequent polling due to change stream failure')

    // Attempt to reconnect after a delay
    setTimeout(async () => {
      this.logger.log('Attempting to reconnect change stream...')
      try {
        await this.startChangeStreamMonitoring()
      } catch (reconnectError) {
        this.logger.error('Failed to reconnect change stream:', reconnectError)
        this.logger.log('Continuing with polling-only mode')
      }
    }, 5000) // 5 second delay before reconnection attempt
  }

  /**
   * Stop MongoDB Change Streams monitoring
   */
  private stopChangeStreamMonitoring(): void {
    if (this.changeStream) {
      this.changeStream.close()
      this.changeStream = undefined
      this.changeStreamActive = false
      this.logger.log('MongoDB Change Streams monitoring stopped')
    }
  }

  /**
   * Get configuration service status information
   */
  getServiceStatus(): {
    changeStreamsEnabled: boolean
    changeStreamsActive: boolean
    cacheRefreshInterval: number
    cacheSize: number
    mode: 'real-time' | 'polling' | 'hybrid'
  } {
    const interval = this.changeStreamActive
      ? this.CACHE_REFRESH_INTERVAL_WITH_CHANGE_STREAMS
      : this.CACHE_REFRESH_INTERVAL

    let mode: 'real-time' | 'polling' | 'hybrid' = 'polling'
    if (this.changeStreamActive && this.changeStreamEnabled) {
      mode = 'real-time'
    } else if (this.changeStreamEnabled) {
      mode = 'hybrid' // Change streams enabled but not active (fallback mode)
    }

    return {
      changeStreamsEnabled: this.changeStreamEnabled,
      changeStreamsActive: this.changeStreamActive,
      cacheRefreshInterval: interval,
      cacheSize: this.configCache.size,
      mode,
    }
  }

  /**
   * Cleanup method called when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('ConfigurationService shutting down...')

    // Stop cache refresh timer
    this.stopCacheRefreshTimer()

    // Stop change stream monitoring
    this.stopChangeStreamMonitoring()

    this.logger.log('ConfigurationService shutdown complete')
  }
}
