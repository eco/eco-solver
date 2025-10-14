import { Configuration, ConfigurationDocument } from '@/dynamic-config/schemas/configuration.schema'
import {
  IConfigurationRepository,
  CreateConfigurationDTO,
  UpdateConfigurationDTO,
  ConfigurationFilter,
  BulkConfigurationOperation,
  BulkOperationResult,
  PaginationOptions,
  PaginatedResult,
} from '@/dynamic-config/interfaces/configuration-repository.interface'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, FilterQuery } from 'mongoose'

@Injectable()
export class DynamicConfigRepository implements IConfigurationRepository {
  private readonly logger = new Logger(DynamicConfigRepository.name)

  constructor(
    @InjectModel(Configuration.name)
    private readonly configurationModel: Model<ConfigurationDocument>,
  ) {}

  async create(data: CreateConfigurationDTO): Promise<ConfigurationDocument> {
    try {
      this.logger.debug(`Creating configuration with key: ${data.key}`)

      // Validate the configuration data
      const validationErrors = await this.validateConfiguration(data)
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`)
      }

      const configuration = new this.configurationModel({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const savedConfiguration = await configuration.save()
      this.logger.debug(`Successfully created configuration: ${data.key}`)

      return savedConfiguration
    } catch (error) {
      this.logger.error(`Failed to create configuration ${data.key}:`, error)
      throw error
    }
  }

  async findByKey(key: string): Promise<ConfigurationDocument | null> {
    try {
      this.logger.debug(`Finding configuration by key: ${key}`)
      return await this.configurationModel.findOne({ key }).exec()
    } catch (error) {
      this.logger.error(`Failed to find configuration by key ${key}:`, error)
      throw error
    }
  }

  async findAll(
    filter?: ConfigurationFilter,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>> {
    try {
      this.logger.debug('Finding all configurations with filter:', filter)

      const query = this.buildFilterQuery(filter)
      const { page = 1, limit = 50, sortBy = 'key', sortOrder = 'asc' } = pagination || {}

      const skip = (page - 1) * limit
      const sortObj: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }

      const [data, total] = await Promise.all([
        this.configurationModel.find(query).sort(sortObj).skip(skip).limit(limit).exec(),
        this.configurationModel.countDocuments(query).exec(),
      ])

      const totalPages = Math.ceil(total / limit)

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      this.logger.error('Failed to find configurations:', error)
      throw error
    }
  }

  async update(key: string, data: UpdateConfigurationDTO): Promise<ConfigurationDocument | null> {
    try {
      this.logger.debug(`Updating configuration with key: ${key}`)

      // Validate the update data
      const validationErrors = await this.validateConfiguration(data)
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`)
      }

      const updatedConfiguration = await this.configurationModel
        .findOneAndUpdate(
          { key },
          { ...data, updatedAt: new Date() },
          { new: true, runValidators: true },
        )
        .exec()

      if (updatedConfiguration) {
        this.logger.debug(`Successfully updated configuration: ${key}`)
      } else {
        this.logger.warn(`Configuration not found for update: ${key}`)
      }

      return updatedConfiguration
    } catch (error) {
      this.logger.error(`Failed to update configuration ${key}:`, error)
      throw error
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.logger.debug(`Deleting configuration with key: ${key}`)

      const result = await this.configurationModel.deleteOne({ key }).exec()
      const deleted = result.deletedCount > 0

      if (deleted) {
        this.logger.debug(`Successfully deleted configuration: ${key}`)
      } else {
        this.logger.warn(`Configuration not found for deletion: ${key}`)
      }

      return deleted
    } catch (error) {
      this.logger.error(`Failed to delete configuration ${key}:`, error)
      throw error
    }
  }

  async bulkOperations(operations: BulkConfigurationOperation[]): Promise<BulkOperationResult> {
    this.logger.debug(`Executing ${operations.length} bulk operations`)

    const result: BulkOperationResult = {
      successful: [],
      failed: [],
    }

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case 'create':
            if (!operation.data) {
              throw new Error('Create operation requires data')
            }
            const created = await this.create(operation.data as CreateConfigurationDTO)
            result.successful.push({
              key: operation.key,
              operation: 'create',
              document: created,
            })
            break

          case 'update':
            if (!operation.data) {
              throw new Error('Update operation requires data')
            }
            const updated = await this.update(
              operation.key,
              operation.data as UpdateConfigurationDTO,
            )
            result.successful.push({
              key: operation.key,
              operation: 'update',
              document: updated || undefined,
            })
            break

          case 'delete':
            const deleted = await this.delete(operation.key)
            if (deleted) {
              result.successful.push({
                key: operation.key,
                operation: 'delete',
              })
            } else {
              throw new Error('Configuration not found')
            }
            break

          default:
            throw new Error(`Unknown operation: ${operation.operation}`)
        }
      } catch (error) {
        result.failed.push({
          key: operation.key,
          operation: operation.operation,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    this.logger.debug(
      `Bulk operations completed: ${result.successful.length} successful, ${result.failed.length} failed`,
    )

    return result
  }

  async bulkCreate(configurations: CreateConfigurationDTO[]): Promise<BulkOperationResult> {
    this.logger.debug(`Bulk creating ${configurations.length} configurations`)

    const operations: BulkConfigurationOperation[] = configurations.map((config) => ({
      key: config.key,
      operation: 'create',
      data: config,
    }))

    return this.bulkOperations(operations)
  }

  async bulkUpdate(
    updates: Array<{ key: string; data: UpdateConfigurationDTO }>,
  ): Promise<BulkOperationResult> {
    this.logger.debug(`Bulk updating ${updates.length} configurations`)

    const operations: BulkConfigurationOperation[] = updates.map((update) => ({
      key: update.key,
      operation: 'update',
      data: update.data,
    }))

    return this.bulkOperations(operations)
  }

  async bulkDelete(keys: string[]): Promise<BulkOperationResult> {
    this.logger.debug(`Bulk deleting ${keys.length} configurations`)

    const operations: BulkConfigurationOperation[] = keys.map((key) => ({
      key,
      operation: 'delete',
    }))

    return this.bulkOperations(operations)
  }

  async validateConfiguration(
    data: CreateConfigurationDTO | UpdateConfigurationDTO,
  ): Promise<string[]> {
    const errors: string[] = []

    // Validate key format (only for create operations)
    if ('key' in data && data.key) {
      const keyRegex = /^[a-zA-Z0-9._-]+$/
      if (!keyRegex.test(data.key)) {
        errors.push('Key must contain only alphanumeric characters, dots, underscores, and hyphens')
      }
    }

    // Validate value type matches declared type
    if (data.value !== undefined && data.type) {
      const actualType = Array.isArray(data.value) ? 'array' : typeof data.value
      if (
        actualType !== data.type &&
        !(data.type === 'object' && actualType === 'object' && !Array.isArray(data.value))
      ) {
        errors.push(`Value type '${actualType}' does not match declared type '${data.type}'`)
      }
    }

    // Validate required fields for create operations
    if ('key' in data) {
      if (!data.key) {
        errors.push('Key is required')
      }
      if (data.value === undefined) {
        errors.push('Value is required')
      }
      if (!data.type) {
        errors.push('Type is required')
      }
    }

    return errors
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.configurationModel.exists({ key })
    return Boolean(res)
  }

  async count(filter?: ConfigurationFilter): Promise<number> {
    try {
      const query = this.buildFilterQuery(filter)
      return await this.configurationModel.countDocuments(query).exec()
    } catch (error) {
      this.logger.error('Failed to count configurations:', error)
      throw error
    }
  }

  async findRequired(): Promise<ConfigurationDocument[]> {
    try {
      return await this.configurationModel.find({ isRequired: true }).sort({ key: 1 }).exec()
    } catch (error) {
      this.logger.error('Failed to find required configurations:', error)
      throw error
    }
  }

  async findSecrets(): Promise<ConfigurationDocument[]> {
    try {
      return await this.configurationModel.find({ isSecret: true }).sort({ key: 1 }).exec()
    } catch (error) {
      this.logger.error('Failed to find secret configurations:', error)
      throw error
    }
  }

  async findByType(
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
  ): Promise<ConfigurationDocument[]> {
    try {
      return await this.configurationModel.find({ type }).sort({ key: 1 }).exec()
    } catch (error) {
      this.logger.error(`Failed to find configurations by type ${type}:`, error)
      throw error
    }
  }

  async findByModifier(
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>> {
    try {
      const filter: ConfigurationFilter = { lastModifiedBy: userId }
      return await this.findAll(filter, pagination)
    } catch (error) {
      this.logger.error(`Failed to find configurations by modifier ${userId}:`, error)
      throw error
    }
  }

  async findMissingRequired(requiredKeys: string[]): Promise<string[]> {
    try {
      const existingConfigs = await this.configurationModel
        .find({ key: { $in: requiredKeys } })
        .select('key')
        .exec()

      const existingKeys = existingConfigs.map((config) => config.key)
      return requiredKeys.filter((key) => !existingKeys.includes(key))
    } catch (error) {
      this.logger.error('Failed to find missing required configurations:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.configurationModel.findOne().limit(1).exec()
      return true
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return false
    }
  }

  async getStatistics(): Promise<{
    total: number
    byType: Record<string, number>
    required: number
    secrets: number
    lastModified: Date | null
  }> {
    try {
      const [total, typeStats, required, secrets, lastModifiedDoc] = await Promise.all([
        this.configurationModel.countDocuments().exec(),
        this.configurationModel
          .aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
          .exec(),
        this.configurationModel.countDocuments({ isRequired: true }).exec(),
        this.configurationModel.countDocuments({ isSecret: true }).exec(),
        this.configurationModel.findOne().sort({ updatedAt: -1 }).select('updatedAt').exec(),
      ])

      const byType = typeStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        total,
        byType,
        required,
        secrets,
        lastModified: lastModifiedDoc?.updatedAt || null,
      }
    } catch (error) {
      this.logger.error('Failed to get statistics:', error)
      throw error
    }
  }

  private buildFilterQuery(filter?: ConfigurationFilter): FilterQuery<ConfigurationDocument> {
    if (!filter) return {}

    const query: FilterQuery<ConfigurationDocument> = {}

    if (filter.keys && filter.keys.length > 0) {
      query.key = { $in: filter.keys }
    }

    if (filter.type) {
      query.type = filter.type
    }

    if (filter.isRequired !== undefined) {
      query.isRequired = filter.isRequired
    }

    if (filter.isSecret !== undefined) {
      query.isSecret = filter.isSecret
    }

    if (filter.lastModifiedBy) {
      query.lastModifiedBy = filter.lastModifiedBy
    }

    if (filter.createdAfter || filter.createdBefore) {
      query.createdAt = {}
      if (filter.createdAfter) {
        query.createdAt.$gte = filter.createdAfter
      }
      if (filter.createdBefore) {
        query.createdAt.$lte = filter.createdBefore
      }
    }

    if (filter.updatedAfter || filter.updatedBefore) {
      query.updatedAt = {}
      if (filter.updatedAfter) {
        query.updatedAt.$gte = filter.updatedAfter
      }
      if (filter.updatedBefore) {
        query.updatedAt.$lte = filter.updatedBefore
      }
    }

    return query
  }
}
