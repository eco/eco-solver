import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { FilterQuery, Model } from 'mongoose';

import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoError } from '@/errors/eco-error';
import {
  BulkConfigurationOperation,
  BulkOperationResult,
  ConfigurationFilter,
  CreateConfigurationDTO,
  IConfigurationRepository,
  PaginatedResult,
  PaginationOptions,
  UpdateConfigurationDTO,
} from '@/modules/dynamic-config/interfaces/configuration-repository.interface';
import {
  Configuration,
  ConfigurationDocument,
} from '@/modules/dynamic-config/schemas/configuration.schema';

@Injectable()
export class DynamicConfigRepository implements IConfigurationRepository {
  private readonly logger = new Logger(DynamicConfigRepository.name);

  constructor(
    @InjectModel(Configuration.name)
    private readonly configurationModel: Model<ConfigurationDocument>,
  ) {}

  async create(data: CreateConfigurationDTO): Promise<ConfigurationDocument> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `create: Creating configuration with key: ${data.key}`,
        }),
      );

      // Validate the configuration data
      const validationErrors = await this.validateConfiguration(data);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      const configuration = new this.configurationModel({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedConfiguration = await configuration.save();

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `create: Successfully created configuration with key: ${data.key}`,
        }),
      );

      return savedConfiguration;
    } catch (ex) {
      EcoError.logError(
        ex,
        `create: Failed to create configuration with key: ${data.key}`,
        this.logger,
      );
      throw ex;
    }
  }

  async findByKey(key: string): Promise<ConfigurationDocument | null> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `findByKey: key: ${key})`,
        }),
      );

      return await this.configurationModel.findOne({ key }).exec();
    } catch (ex) {
      EcoError.logError(ex, `findByKey exception: key: ${key}`, this.logger);
      throw ex;
    }
  }

  async findAllWithFilteringAndPagination(
    filter: ConfigurationFilter,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>> {
    try {
      const query = this.buildFilterQuery(filter);
      const { page = 1, limit = 50, sortBy = 'key', sortOrder = 'asc' } = pagination || {};
      const skip = (page - 1) * limit;
      const sortObj: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `findAllWithFilteringAndPagination`,
          properties: {
            filter,
            pagination,
            query,
            sortObj,
            skip,
            limit,
          },
        }),
      );

      const [data, total] = await Promise.all([
        this.configurationModel.find(query).sort(sortObj).skip(skip).limit(limit).exec(),
        this.configurationModel.countDocuments(query).exec(),
      ]);

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `findAllWithFilteringAndPagination: result`,
          properties: {
            data,
            total,
          },
        }),
      );

      const totalPages = Math.ceil(total / limit);

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
      };
    } catch (ex) {
      EcoError.logError(ex, `findAll exception`, this.logger);
      throw ex;
    }
  }

  async update(key: string, data: UpdateConfigurationDTO): Promise<ConfigurationDocument | null> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `update: key: ${key})`,
        }),
      );

      // Validate the update data
      const validationErrors = await this.validateConfiguration(data);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      const updatedConfiguration = await this.configurationModel
        .findOneAndUpdate(
          { key },
          { ...data, updatedAt: new Date() },
          { new: true, runValidators: true },
        )
        .exec();

      if (updatedConfiguration) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `update: Successfully updated configuration: key: ${key})`,
          }),
        );
      } else {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `update: Configuration not found for: key: ${key})`,
          }),
        );
      }

      return updatedConfiguration;
    } catch (ex) {
      EcoError.logError(ex, `update exception: key: ${key}`, this.logger);
      throw ex;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `delete: Deleting configuration with key: ${key}`,
        }),
      );

      const result = await this.configurationModel.deleteOne({ key }).exec();
      const deleted = result.deletedCount > 0;

      if (deleted) {
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `delete: Successfully deleted configuration: ${key}`,
          }),
        );
      } else {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `delete: Configuration not found for deletion: ${key}`,
          }),
        );
      }

      return deleted;
    } catch (ex) {
      EcoError.logError(ex, `delete: Failed to delete configuration ${key}`, this.logger);
      throw ex;
    }
  }

  async bulkOperations(operations: BulkConfigurationOperation[]): Promise<BulkOperationResult> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `bulkOperations: Executing ${operations.length} bulk operations`,
      }),
    );

    const result: BulkOperationResult = {
      successful: [],
      failed: [],
    };

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case 'create':
            if (!operation.data) {
              throw new Error('Create operation requires data');
            }
            const created = await this.create(operation.data as CreateConfigurationDTO);
            result.successful.push({
              key: operation.key,
              operation: 'create',
              document: created,
            });
            break;

          case 'update':
            if (!operation.data) {
              throw new Error('Update operation requires data');
            }
            const updated = await this.update(
              operation.key,
              operation.data as UpdateConfigurationDTO,
            );
            result.successful.push({
              key: operation.key,
              operation: 'update',
              document: updated || undefined,
            });
            break;

          case 'delete':
            const deleted = await this.delete(operation.key);
            if (deleted) {
              result.successful.push({
                key: operation.key,
                operation: 'delete',
              });
            } else {
              throw new Error('Configuration not found');
            }
            break;

          default:
            throw new Error(`Unknown operation: ${operation.operation}`);
        }
      } catch (ex) {
        result.failed.push({
          key: operation.key,
          operation: operation.operation,
          error: ex instanceof Error ? ex.message : String(ex),
        });
      }
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `bulkOperations: Bulk operations completed`,
        properties: {
          successful: result.successful.length,
          failed: result.failed.length,
        },
      }),
    );

    return result;
  }

  async bulkCreate(configurations: CreateConfigurationDTO[]): Promise<BulkOperationResult> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `bulkCreate: Bulk creating ${configurations.length} configurations`,
      }),
    );

    const operations: BulkConfigurationOperation[] = configurations.map((config) => ({
      key: config.key,
      operation: 'create',
      data: config,
    }));

    return this.bulkOperations(operations);
  }

  async bulkUpdate(
    updates: Array<{ key: string; data: UpdateConfigurationDTO }>,
  ): Promise<BulkOperationResult> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `bulkUpdate: Bulk updating ${updates.length} configurations`,
      }),
    );

    const operations: BulkConfigurationOperation[] = updates.map((update) => ({
      key: update.key,
      operation: 'update',
      data: update.data,
    }));

    return this.bulkOperations(operations);
  }

  async bulkDelete(keys: string[]): Promise<BulkOperationResult> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `bulkDelete: Bulk deleting ${keys.length} configurations`,
      }),
    );

    const operations: BulkConfigurationOperation[] = keys.map((key) => ({
      key,
      operation: 'delete',
    }));

    return this.bulkOperations(operations);
  }

  async validateConfiguration(
    data: CreateConfigurationDTO | UpdateConfigurationDTO,
  ): Promise<string[]> {
    const errors: string[] = [];

    // Validate key format (only for create operations)
    if ('key' in data && data.key) {
      const keyRegex = /^[a-zA-Z0-9._-]+$/;
      if (!keyRegex.test(data.key)) {
        errors.push(
          'Key must contain only alphanumeric characters, dots, underscores, and hyphens',
        );
      }
    }

    // Validate value type matches declared type
    if (data.value !== undefined && data.type) {
      const actualType = Array.isArray(data.value) ? 'array' : typeof data.value;
      if (
        actualType !== data.type &&
        !(data.type === 'object' && actualType === 'object' && !Array.isArray(data.value))
      ) {
        errors.push(`Value type '${actualType}' does not match declared type '${data.type}'`);
      }
    }

    // Validate required fields for create operations
    if ('key' in data) {
      if (!data.key) {
        errors.push('Key is required');
      }
      if (data.value === undefined) {
        errors.push('Value is required');
      }
      if (!data.type) {
        errors.push('Type is required');
      }
    }

    return errors;
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.configurationModel.exists({ key });
    return Boolean(res);
  }

  async count(filter?: ConfigurationFilter): Promise<number> {
    try {
      const query = this.buildFilterQuery(filter);
      return await this.configurationModel.countDocuments(query).exec();
    } catch (ex) {
      EcoError.logError(ex, `count: Failed to count configurations`, this.logger);
      throw ex;
    }
  }

  async findRequired(): Promise<ConfigurationDocument[]> {
    try {
      return await this.configurationModel.find({ isRequired: true }).sort({ key: 1 }).exec();
    } catch (ex) {
      EcoError.logError(ex, `findRequired: Failed to find required configurations`, this.logger);
      throw ex;
    }
  }

  async findByType(
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
  ): Promise<ConfigurationDocument[]> {
    try {
      return await this.configurationModel.find({ type }).sort({ key: 1 }).exec();
    } catch (ex) {
      EcoError.logError(
        ex,
        `findByType: Failed to find configurations by type ${type}`,
        this.logger,
      );
      throw ex;
    }
  }

  async findByModifier(
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<ConfigurationDocument>> {
    try {
      const filter: ConfigurationFilter = { lastModifiedBy: userId };
      return await this.findAllWithFilteringAndPagination(filter, pagination);
    } catch (ex) {
      EcoError.logError(
        ex,
        `findByModifier: Failed to find configurations by modifier ${userId}`,
        this.logger,
      );
      throw ex;
    }
  }

  async findMissingRequired(requiredKeys: string[]): Promise<string[]> {
    try {
      const existingConfigs = await this.configurationModel
        .find({ key: { $in: requiredKeys } })
        .select('key')
        .exec();

      const existingKeys = existingConfigs.map((config) => config.key);
      return requiredKeys.filter((key) => !existingKeys.includes(key));
    } catch (ex) {
      EcoError.logError(
        ex,
        `findMissingRequired: Failed to find missing required configurations`,
        this.logger,
        {
          requiredKeys,
        },
      );
      throw ex;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.configurationModel.findOne().limit(1).exec();
      return true;
    } catch (ex) {
      EcoError.logError(ex, `healthCheck: health check failed`, this.logger);
      return false;
    }
  }

  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    required: number;
    lastModified: Date | null;
  }> {
    try {
      const [total, typeStats, required, lastModifiedDoc] = await Promise.all([
        this.configurationModel.countDocuments().exec(),
        this.configurationModel
          .aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
          .exec(),
        this.configurationModel.countDocuments({ isRequired: true }).exec(),
        this.configurationModel.findOne().sort({ updatedAt: -1 }).select('updatedAt').exec(),
      ]);

      const byType = typeStats.reduce(
        (acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        total,
        byType,
        required,
        lastModified: lastModifiedDoc?.updatedAt || null,
      };
    } catch (ex) {
      EcoError.logError(ex, `getStatistics: Failed to get statistics`, this.logger);
      throw ex;
    }
  }

  private buildFilterQuery(filter?: ConfigurationFilter): FilterQuery<ConfigurationDocument> {
    if (!filter) return {};

    const query: FilterQuery<ConfigurationDocument> = {};

    if (filter.keys && filter.keys.length > 0) {
      query.key = { $in: filter.keys };
    }

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.isRequired !== undefined) {
      query.isRequired = filter.isRequired;
    }

    if (filter.lastModifiedBy) {
      query.lastModifiedBy = filter.lastModifiedBy;
    }

    if (filter.createdAfter || filter.createdBefore) {
      query.createdAt = {};
      if (filter.createdAfter) {
        query.createdAt.$gte = filter.createdAfter;
      }
      if (filter.createdBefore) {
        query.createdAt.$lte = filter.createdBefore;
      }
    }

    if (filter.updatedAfter || filter.updatedBefore) {
      query.updatedAt = {};
      if (filter.updatedAfter) {
        query.updatedAt.$gte = filter.updatedAfter;
      }
      if (filter.updatedBefore) {
        query.updatedAt.$lte = filter.updatedBefore;
      }
    }

    return query;
  }
}
