import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoError } from '@/errors/eco-error';
import {
  ConfigurationAudit,
  ConfigurationAuditDocument,
} from '@/modules/dynamic-config/schemas/configuration-audit.schema';

export interface AuditLogEntry {
  configKey: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValue?: any;
  newValue?: any;
  userId: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditFilter {
  configKey?: string;
  userId?: string;
  operation?: 'CREATE' | 'UPDATE' | 'DELETE';
  startDate?: Date;
  endDate?: Date;
}

export interface AuditStatistics {
  totalOperations: number;
  operationCounts: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topConfigs: Array<{ configKey: string; count: number }>;
  recentActivity: ConfigurationAuditDocument[];
}

@Injectable()
export class DynamicConfigAuditRepository {
  private readonly logger = new Logger(DynamicConfigAuditRepository.name);

  constructor(
    @InjectModel(ConfigurationAudit.name)
    private readonly auditModel: Model<ConfigurationAuditDocument>,
  ) {}

  /**
   * Create an audit log entry
   */
  async create(entry: AuditLogEntry): Promise<ConfigurationAuditDocument> {
    try {
      const auditLog = new this.auditModel({
        configKey: entry.configKey,
        operation: entry.operation,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        userId: entry.userId,
        userAgent: entry.userAgent,
        timestamp: entry.timestamp,
      });

      const savedLog = await auditLog.save();

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `create: Audit log created for config: ${entry.configKey}}`,
        }),
      );

      return savedLog;
    } catch (ex) {
      EcoError.logError(
        ex,
        `create: Failed to create audit log for ${entry.configKey})`,
        this.logger,
      );
      throw ex;
    }
  }

  /**
   * Get configuration history with filtering and pagination
   */
  async findHistory(
    configKey: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ logs: ConfigurationAuditDocument[]; total: number }> {
    try {
      const query = { configKey };

      const [logs, total] = await Promise.all([
        this.auditModel.find(query).sort({ timestamp: -1 }).skip(offset).limit(limit).exec(),
        this.auditModel.countDocuments(query).exec(),
      ]);

      return { logs, total };
    } catch (ex) {
      EcoError.logError(ex, `findHistory: Failed to get history for ${configKey})`, this.logger);
      throw ex;
    }
  }

  /**
   * Get user activity
   */
  async findUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ logs: ConfigurationAuditDocument[]; total: number }> {
    try {
      const query = { userId };

      const [logs, total] = await Promise.all([
        this.auditModel.find(query).sort({ timestamp: -1 }).skip(offset).limit(limit).exec(),
        this.auditModel.countDocuments(query).exec(),
      ]);

      return { logs, total };
    } catch (ex) {
      EcoError.logError(
        ex,
        `findUserActivity: Failed to get user activity for ${userId})`,
        this.logger,
      );
      throw ex;
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<AuditStatistics> {
    try {
      const matchStage: any = {};
      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = startDate;
        if (endDate) matchStage.timestamp.$lte = endDate;
      }

      const pipeline: any[] = [];

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      pipeline.push({
        $facet: {
          totalOperations: [{ $count: 'count' }],
          operationCounts: [
            { $group: { _id: '$operation', count: { $sum: 1 } } },
            { $project: { operation: '$_id', count: 1, _id: 0 } },
          ],
          topUsers: [
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { userId: '$_id', count: 1, _id: 0 } },
          ],
          topConfigs: [
            { $group: { _id: '$configKey', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { configKey: '$_id', count: 1, _id: 0 } },
          ],
        },
      });

      const [result] = await this.auditModel.aggregate(pipeline).exec();

      // Get recent activity
      const recentActivity = await this.auditModel
        .find(matchStage)
        .sort({ timestamp: -1 })
        .limit(20)
        .exec();

      return {
        totalOperations: result.totalOperations[0]?.count || 0,
        operationCounts: result.operationCounts.reduce((acc: Record<string, number>, item: any) => {
          acc[item.operation] = item.count;
          return acc;
        }, {}),
        topUsers: result.topUsers,
        topConfigs: result.topConfigs,
        recentActivity,
      };
    } catch (ex) {
      EcoError.logError(ex, `getStatistics: Failed to get audit statistics`, this.logger);
      throw ex;
    }
  }

  /**
   * Find audit logs with filtering
   */
  async findWithFilter(filter: AuditFilter): Promise<ConfigurationAuditDocument[]> {
    try {
      const query = this.buildQuery(filter);
      return await this.auditModel.find(query).sort({ timestamp: -1 }).exec();
    } catch (ex) {
      EcoError.logError(ex, `findWithFilter: Failed to find audit logs with filter`, this.logger);
      throw ex;
    }
  }

  /**
   * Find audit logs with filtering and pagination
   */
  async findWithFilterPaginated(
    filter: AuditFilter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: ConfigurationAuditDocument[]; total: number }> {
    try {
      const query = this.buildQuery(filter);

      const [logs, total] = await Promise.all([
        this.auditModel.find(query).sort({ timestamp: -1 }).skip(offset).limit(limit).exec(),
        this.auditModel.countDocuments(query).exec(),
      ]);

      return { logs, total };
    } catch (ex) {
      EcoError.logError(
        ex,
        `findWithFilterPaginated: Failed to find audit logs with filter and pagination`,
        this.logger,
      );
      throw ex;
    }
  }

  /**
   * Delete old audit logs (for cleanup)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const result = await this.auditModel.deleteMany({ timestamp: { $lt: date } }).exec();

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `deleteOlderThan: Deleted ${result.deletedCount} old audit logs`,
        }),
      );

      return result.deletedCount || 0;
    } catch (ex) {
      EcoError.logError(ex, `deleteOlderThan: Failed to delete old audit logs`, this.logger);
      throw ex;
    }
  }

  /**
   * Get audit logs count
   */
  async count(filter?: AuditFilter): Promise<number> {
    try {
      const query = filter ? this.buildQuery(filter) : {};
      return await this.auditModel.countDocuments(query).exec();
    } catch (ex) {
      EcoError.logError(ex, `count: Failed to count audit logs`, this.logger);
      throw ex;
    }
  }

  /**
   * Build MongoDB query from filter
   */
  private buildQuery(filter: AuditFilter): any {
    const query: any = {};

    if (filter.configKey) {
      query.configKey = filter.configKey;
    }

    if (filter.userId) {
      query.userId = filter.userId;
    }

    if (filter.operation) {
      query.operation = filter.operation;
    }

    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) {
        query.timestamp.$gte = filter.startDate;
      }
      if (filter.endDate) {
        query.timestamp.$lte = filter.endDate;
      }
    }

    return query;
  }

  /**
   * Health check for the audit repository
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.auditModel.findOne().limit(1).exec();
      return true;
    } catch (ex) {
      EcoError.logError(ex, `healthCheck: Audit repository health check failed`, this.logger);
      return false;
    }
  }
}
