import { ConfigurationAuditDocument } from '@/dynamic-config/schemas/configuration-audit.schema'
import {
  DynamicConfigAuditRepository,
  AuditLogEntry,
  AuditFilter,
  AuditStatistics,
} from '@/dynamic-config/repositories/dynamic-config-audit.repository'
import { ConfigurationChangeEvent } from '@/dynamic-config/services/dynamic-config.service'
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class DynamicConfigAuditService {
  private readonly logger = new Logger(DynamicConfigAuditService.name)

  constructor(private readonly auditRepository: DynamicConfigAuditRepository) {}

  /**
   * Create an audit log entry
   */
  async createAuditLog(entry: AuditLogEntry): Promise<ConfigurationAuditDocument> {
    try {
      this.logger.debug(`Creating audit log for ${entry.operation} on ${entry.configKey}`)
      const savedLog = await this.auditRepository.create(entry)
      this.logger.debug(`Audit log created with ID: ${savedLog._id}`)
      return savedLog
    } catch (error) {
      this.logger.error(`Failed to create audit log for ${entry.configKey}:`, error)
      throw error
    }
  }

  /**
   * Get audit history for a specific configuration key
   */
  async getConfigurationHistory(
    configKey: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ConfigurationAuditDocument[]> {
    try {
      const { logs } = await this.auditRepository.findHistory(configKey, limit, offset)
      return logs
    } catch (error) {
      this.logger.error(`Failed to get history for ${configKey}:`, error)
      throw error
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    filter: AuditFilter = {},
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    logs: ConfigurationAuditDocument[]
    total: number
  }> {
    try {
      const logs = await this.auditRepository.findWithFilter(filter)
      const total = await this.auditRepository.count(filter)

      // Apply pagination manually since the repository method doesn't support it yet
      const paginatedLogs = logs.slice(offset, offset + limit)

      return { logs: paginatedLogs, total }
    } catch (error) {
      this.logger.error('Failed to get audit logs:', error)
      throw error
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate?: Date, endDate?: Date): Promise<AuditStatistics> {
    try {
      return await this.auditRepository.getStatistics(startDate, endDate)
    } catch (error) {
      this.logger.error('Failed to get audit statistics:', error)
      throw error
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ConfigurationAuditDocument[]> {
    try {
      const { logs } = await this.auditRepository.findUserActivity(userId, limit, offset)
      return logs
    } catch (error) {
      this.logger.error(`Failed to get user activity for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(olderThan: Date): Promise<number> {
    try {
      this.logger.log(`Cleaning up audit logs older than ${olderThan.toISOString()}`)
      const deletedCount = await this.auditRepository.deleteOlderThan(olderThan)
      this.logger.log(`Cleaned up ${deletedCount} old audit logs`)
      return deletedCount
    } catch (error) {
      this.logger.error('Failed to cleanup old audit logs:', error)
      throw error
    }
  }

  /**
   * Handle configuration change event
   */
  async handleConfigurationChange(event: ConfigurationChangeEvent): Promise<void> {
    try {
      await this.createAuditLog({
        configKey: event.key,
        operation: event.operation,
        oldValue: event.oldValue,
        newValue: event.newValue,
        userId: event.userId || 'system',
        userAgent: event.userAgent,
        ipAddress: event.ipAddress,
        timestamp: event.timestamp,
      })
    } catch (error) {
      this.logger.error('Failed to handle configuration change event:', error)
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(filter: AuditFilter = {}): Promise<string> {
    try {
      const logs = await this.auditRepository.findWithFilter(filter)

      return JSON.stringify(
        logs.map((log) => ({
          id: log._id,
          configKey: log.configKey,
          operation: log.operation,
          oldValue: (log as any).getMaskedOldValue?.() || this.maskSensitiveValue(log.oldValue),
          newValue: (log as any).getMaskedNewValue?.() || this.maskSensitiveValue(log.newValue),
          userId: log.userId,
          userAgent: log.userAgent,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
        })),
        null,
        2,
      )
    } catch (error) {
      this.logger.error('Failed to export audit logs:', error)
      throw error
    }
  }

  /**
   * Mask sensitive values for security
   */
  private maskSensitiveValue(value: any): any {
    if (value && typeof value === 'object' && value.isSecret) {
      return '***MASKED***'
    }
    return value
  }
}
