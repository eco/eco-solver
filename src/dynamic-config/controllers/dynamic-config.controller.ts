import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { AuditQueryDTO } from '@/dynamic-config/dtos/audit-query.dto'
import { ConfigurationQueryDTO } from '@/dynamic-config/dtos/configuration-query.dto'
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common'
import { CreateConfigurationDTO } from '@/dynamic-config/dtos/create-configuration.dto'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import {
  PaginatedAuditResponseDTO,
  AuditLogResponseDTO,
} from '@/dynamic-config/dtos/audit-response.dto'
import {
  PaginatedConfigurationResponseDTO,
  ConfigurationResponseDTO,
} from '@/dynamic-config/dtos/configuration-response.dto'
import { Request } from 'express'
import { UpdateConfigurationDTO } from '@/dynamic-config/dtos/update-configuration.dto'
import { RequestSignatureGuard } from '@/request-signing/request-signature.guard'
import { RequestHeaders } from '@/request-signing/request-headers'

@ApiTags('Configuration')
@Controller('api/v1/configuration')
@UseGuards(RequestSignatureGuard)
export class DynamicConfigController {
  private readonly logger = new Logger(DynamicConfigController.name)

  constructor(private readonly configurationService: DynamicConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all configurations',
    description: 'Retrieve all configurations with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Configurations retrieved successfully',
    type: PaginatedConfigurationResponseDTO,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllConfigurations(
    @Query() query: ConfigurationQueryDTO,
  ): Promise<PaginatedConfigurationResponseDTO> {
    try {
      this.logger.log('Getting all configurations with filters:', query)
      const result = await this.configurationService.getAllQuery(query)

      // Transform to response DTOs
      const responseData = result.data.map((config) => this.toResponseDTO(config))

      return {
        data: responseData,
        pagination: result.pagination,
      }
    } catch (error) {
      this.logger.error('Failed to get configurations:', error)
      throw new HttpException('Failed to retrieve configurations', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Get configuration by key',
    description: 'Retrieve a specific configuration by its key',
  })
  @ApiParam({
    name: 'key',
    description: 'Configuration key',
    example: 'database.maxPoolSize',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    type: ConfigurationResponseDTO,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getConfiguration(@Param('key') key: string): Promise<ConfigurationResponseDTO> {
    try {
      this.logger.log(`Getting configuration: ${key}`)

      const config = await this.configurationService.get(key)
      if (!config) {
        throw new HttpException(`Configuration not found: ${key}`, HttpStatus.NOT_FOUND)
      }

      // Get the full configuration document for response
      const configDoc = await this.configurationService['configRepository'].findByKey(key)
      if (!configDoc) {
        throw new HttpException(`Configuration not found: ${key}`, HttpStatus.NOT_FOUND)
      }

      return this.toResponseDTO({
        key: configDoc.key,
        value: config, // This will be masked if secret
        type: configDoc.type,
        isRequired: configDoc.isRequired,
        isSecret: configDoc.isSecret,
        description: configDoc.description,
        lastModified: configDoc.updatedAt,
      })
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`Failed to get configuration ${key}:`, error)
      throw new HttpException('Failed to retrieve configuration', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create new configuration',
    description: 'Create a new configuration entry (Admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
    type: ConfigurationResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 409,
    description: 'Configuration already exists',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createConfiguration(
    @Body() createConfigurationDTO: CreateConfigurationDTO,
    @Req() request: Request,
  ): Promise<ConfigurationResponseDTO> {
    try {
      this.logger.log(`Creating configuration: ${createConfigurationDTO.key}`)

      // Check if configuration already exists
      const exists = await this.configurationService.exists(createConfigurationDTO.key)
      if (exists) {
        throw new HttpException(
          `Configuration already exists: ${createConfigurationDTO.key}`,
          HttpStatus.CONFLICT,
        )
      }

      // Extract user context
      const { userId, userAgent } = this.getUserContext(request)

      const config = await this.configurationService.create(
        createConfigurationDTO,
        userId,
        userAgent,
      )

      return this.toResponseDTO({
        key: config.key,
        value: config.isSecret ? '***MASKED***' : config.value,
        type: config.type,
        isRequired: config.isRequired,
        isSecret: config.isSecret,
        description: config.description,
        lastModified: config.updatedAt,
      })
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`Failed to create configuration ${createConfigurationDTO.key}:`, error)

      // Handle validation errors
      if (error.message?.includes('validation failed')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
      }

      throw new HttpException('Failed to create configuration', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Put(':key')
  @ApiOperation({
    summary: 'Update configuration',
    description: 'Update an existing configuration by key (Admin only)',
  })
  @ApiParam({
    name: 'key',
    description: 'Configuration key',
    example: 'database.maxPoolSize',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    type: ConfigurationResponseDTO,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateConfiguration(
    @Param('key') key: string,
    @Body() updateDTO: UpdateConfigurationDTO,
    @Req() request: Request,
  ): Promise<ConfigurationResponseDTO> {
    try {
      this.logger.log(`Updating configuration: ${key}`)

      // Extract user context
      const { userId, userAgent } = this.getUserContext(request)

      const config = await this.configurationService.update(key, updateDTO, userId, userAgent)

      if (!config) {
        throw new HttpException(`Configuration not found: ${key}`, HttpStatus.NOT_FOUND)
      }

      return this.toResponseDTO({
        key: config.key,
        value: config.isSecret ? '***MASKED***' : config.value,
        type: config.type,
        isRequired: config.isRequired,
        isSecret: config.isSecret,
        description: config.description,
        lastModified: config.updatedAt,
      })
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`Failed to update configuration ${key}:`, error)

      // Handle validation errors
      if (error.message?.includes('validation failed')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
      }

      throw new HttpException('Failed to update configuration', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Delete(':key')
  @ApiOperation({
    summary: 'Delete configuration',
    description: 'Delete a configuration by key (Admin only)',
  })
  @ApiParam({
    name: 'key',
    description: 'Configuration key',
    example: 'database.maxPoolSize',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete required configuration',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async deleteConfiguration(
    @Param('key') key: string,
    @Req() request: Request,
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting configuration: ${key}`)

      // Extract user context
      const { userId, userAgent } = this.getUserContext(request)

      const deleted = await this.configurationService.delete(key, userId, userAgent)

      if (!deleted) {
        throw new HttpException(`Configuration not found: ${key}`, HttpStatus.NOT_FOUND)
      }

      return { message: `Configuration deleted successfully: ${key}` }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`Failed to delete configuration ${key}:`, error)

      // Handle required configuration error
      if (error.message?.includes('Cannot delete required configuration')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST)
      }

      throw new HttpException('Failed to delete configuration', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(':key/audit')
  @ApiOperation({
    summary: 'Get configuration audit history',
    description: 'Retrieve audit history for a specific configuration key',
  })
  @ApiParam({
    name: 'key',
    description: 'Configuration key',
    example: 'database.maxPoolSize',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit history retrieved successfully',
    type: PaginatedAuditResponseDTO,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getConfigurationAuditHistory(
    @Param('key') key: string,
    @Query() query: AuditQueryDTO,
  ): Promise<PaginatedAuditResponseDTO> {
    try {
      this.logger.log(`Getting audit history for configuration: ${key}`)

      // Check if configuration exists
      const exists = await this.configurationService.exists(key)
      if (!exists) {
        throw new HttpException(`Configuration not found: ${key}`, HttpStatus.NOT_FOUND)
      }

      const limit = query.limit || 50
      const offset = query.offset || 0

      const auditLogs = await this.configurationService.getAuditHistory(key, limit, offset)

      // Transform to response DTOs
      const responseData = auditLogs.map((log) => this.toAuditResponseDTO(log))

      // Get total count for the specific configuration
      // Note: This is a simplified approach. In a real implementation, you might want
      // to add a count method to the audit service for better performance
      const allLogs = await this.configurationService.getAuditHistory(key, 1000, 0)
      const total = allLogs.length

      return {
        data: responseData,
        total,
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }
      this.logger.error(`Failed to get audit history for ${key}:`, error)
      throw new HttpException('Failed to retrieve audit history', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * Transform cached configuration to response DTO
   */
  private toResponseDTO(config: any): ConfigurationResponseDTO {
    return {
      id: config._id || 'generated-id',
      key: config.key,
      value: config.value,
      type: config.type,
      isRequired: config.isRequired,
      isSecret: config.isSecret,
      description: config.description,
      lastModifiedBy: config.lastModifiedBy,
      createdAt: config.createdAt || config.lastModified,
      updatedAt: config.updatedAt || config.lastModified,
    }
  }

  /**
   * Transform audit log to response DTO
   */
  private toAuditResponseDTO(auditLog: any): AuditLogResponseDTO {
    return {
      id: auditLog._id?.toString() || auditLog.id?.toString() || 'unknown',
      configKey: auditLog.configKey,
      operation: auditLog.operation,
      oldValue: (auditLog as any).getMaskedOldValue?.() || auditLog.oldValue,
      newValue: (auditLog as any).getMaskedNewValue?.() || auditLog.newValue,
      userId: auditLog.userId,
      userAgent: auditLog.userAgent,
      timestamp: auditLog.timestamp,
      createdAt: auditLog.createdAt,
      updatedAt: auditLog.updatedAt,
    }
  }

  private getUserContext(request: Request) {
    const requestHeaders = new RequestHeaders(request.headers)

    // Extract user context
    const { address } = requestHeaders.getSignatureValidationData()

    return {
      userId: address,
      userAgent: requestHeaders.getHeader('User-Agent'),
    }
  }
}
