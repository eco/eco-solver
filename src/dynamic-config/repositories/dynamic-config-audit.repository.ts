import {
  ConfigurationAudit,
  ConfigurationAuditDocument,
} from '@/dynamic-config/schemas/configuration-audit.schema'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

export interface AuditLogEntry {
  configKey: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  oldValue?: any
  newValue?: any
  userId: string
  userAgent?: string
  ipAddress?: string
  timestamp: Date
}

export interface AuditFilter {
  configKey?: string
  userId?: string
  operation?: 'CREATE' | 'UPDATE' | 'DELETE'
  startDate?: Date
  endDate?: Date
}

export interface AuditStatistics {
  totalOperations: number
  operationCounts: Record<string, number>
  topUsers: Array<{ userId: string; count: number }>
  topConfigs: Array<{ configKey: string; count: number }>
  recentActivity: ConfigurationAuditDocument[]
}

@Injectable()
export class DynamicConfigAuditRepository {
  private readonly logger = new Logger(DynamicConfigAuditRepository.name)

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
        ipAddress: entry.ipAddress,
        timestamp: entry.timestamp,
      })

      const savedLog = await auditLog.save()
      this.logger.debug(`Audit log created for config: ${entry.configKey}`)
      return savedLog
    } catch (error) {
      this.logger.error(`Failed to create audit log for ${entry.configKey}:`, error)
      throw error
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
      const query = { configKey }

      const [logs, total] = await Promise.all([
        this.auditModel.find(query).sort({ timestamp: -1 }).skip(offset).limit(limit).exec(),
        this.auditModel.countDocuments(query).exec(),
      ])

      return { logs, total }
    } catch (error) {
      this.logger.error(`Failed to get history for ${configKey}:`, error)
      throw error
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
      const query = { userId }

      const [logs, total] = await Promise.all([
        this.auditModel.find(query).sort({ timestamp: -1 }).skip(offset).limit(limit).exec(),
        this.auditModel.countDocuments(query).exec(),
      ])

      return { logs, total }
    } catch (error) {
      this.logger.error(`Failed to get user activity for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<AuditStatistics> {
    try {
      const matchStage: any = {}
      if (startDate || endDate) {
        matchStage.timestamp = {}
        if (startDate) matchStage.timestamp.$gte = startDate
        if (endDate) matchStage.timestamp.$lte = endDate
      }

      const pipeline: any[] = []

      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage })
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
      })

      const [result] = await this.auditModel.aggregate(pipeline).exec()

      // Get recent activity
      const recentActivity = await this.auditModel
        .find(matchStage)
        .sort({ timestamp: -1 })
        .limit(20)
        .exec()

      return {
        totalOperations: result.totalOperations[0]?.count || 0,
        operationCounts: result.operationCounts.reduce((acc: Record<string, number>, item: any) => {
          acc[item.operation] = item.count
          return acc
        }, {}),
        topUsers: result.topUsers,
        topConfigs: result.topConfigs,
        recentActivity,
      }
    } catch (error) {
      this.logger.error('Failed to get audit statistics:', error)
      throw error
    }
  }

  /**
   * Find audit logs with filtering
   */
  async findWithFilter(filter: AuditFilter): Promise<ConfigurationAuditDocument[]> {
    try {
      const query = this.buildQuery(filter)
      return await this.auditModel.find(query).sort({ timestamp: -1 }).exec()
    } catch (error) {
      this.logger.error('Failed to find audit logs with filter:', error)
      throw error
    }
  }

  /**
   * Delete old audit logs (for cleanup)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const result = await this.auditModel.deleteMany({ timestamp: { $lt: date } }).exec()
      this.logger.log(`Deleted ${result.deletedCount} old audit logs`)
      return result.deletedCount || 0
    } catch (error) {
      this.logger.error('Failed to delete old audit logs:', error)
      throw error
    }
  }

  /**
   * Get audit logs count
   */
  async count(filter?: AuditFilter): Promise<number> {
    try {
      const query = filter ? this.buildQuery(filter) : {}
      return await this.auditModel.countDocuments(query).exec()
    } catch (error) {
      this.logger.error('Failed to count audit logs:', error)
      throw error
    }
  }

  /**
   * Build MongoDB query from filter
   */
  private buildQuery(filter: AuditFilter): any {
    const query: any = {}

    if (filter.configKey) {
      query.configKey = filter.configKey
    }

    if (filter.userId) {
      query.userId = filter.userId
    }

    if (filter.operation) {
      query.operation = filter.operation
    }

    if (filter.startDate || filter.endDate) {
      query.timestamp = {}
      if (filter.startDate) {
        query.timestamp.$gte = filter.startDate
      }
      if (filter.endDate) {
        query.timestamp.$lte = filter.endDate
      }
    }

    return query
  }

  /**
   * Health check for the audit repository
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.auditModel.findOne().limit(1).exec()
      return true
    } catch (error) {
      this.logger.error('Audit repository health check failed:', error)
      return false
    }
  }
}
