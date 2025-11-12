import { AuditQueryDTO } from '@/dynamic-config/dtos/audit-query.dto'
import { ConfigurationQueryDTO } from '@/dynamic-config/dtos/configuration-query.dto'
import { ConfigurationType } from '@/dynamic-config/enums/configuration-type.enum'
import { CreateConfigurationDTO } from '@/dynamic-config/dtos/create-configuration.dto'
import { DynamicConfigController } from '@/dynamic-config/controllers/dynamic-config.controller'
import { DynamicConfigService } from '@/dynamic-config/services/dynamic-config.service'
import { HttpException, HttpStatus } from '@nestjs/common'
import { RequestSignatureGuard } from '@/request-signing/request-signature.guard'
import {
  SIGNATURE_ADDRESS_HEADER,
  SIGNATURE_EXPIRE_HEADER,
  SIGNATURE_HEADER,
} from '@/request-signing/interfaces/signature-headers.interface'
import { Test, TestingModule } from '@nestjs/testing'
import { UpdateConfigurationDTO } from '@/dynamic-config/dtos/update-configuration.dto'

describe('ConfigurationController', () => {
  let controller: DynamicConfigController
  let service: jest.Mocked<DynamicConfigService>

  const mockRequest = {
    headers: {
      'user-agent': 'Mozilla/5.0',
      [SIGNATURE_HEADER]: 'mock-signature',
      [SIGNATURE_ADDRESS_HEADER]: '0x1234567890123456789012345678901234567890',
      [SIGNATURE_EXPIRE_HEADER]: '1234567890',
    },
    get: jest.fn(),
  } as any

  const mockConfigDocument = {
    _id: 'mock-config-id',
    key: 'test.key',
    value: 'test-value',
    type: ConfigurationType.STRING,
    isRequired: false,
    description: 'Test configuration',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockAuditLogsResponse = {
    logs: [
      {
        _id: 'mock-audit-id',
        configKey: 'test.key',
        operation: 'CREATE' as const,
        newValue: 'test-value',
        userId: 'test-user-id',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        getMaskedOldValue: jest.fn().mockReturnValue(null),
        getMaskedNewValue: jest.fn().mockReturnValue('test-value'),
      },
    ],
    total: 1,
  }

  beforeEach(async () => {
    const mockService = {
      getAllQuery: jest.fn(),
      getAll: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getAuditHistory: jest.fn(),
      getAuditHistoryCountForKey: jest.fn(),
      findByKey: jest.fn(),
    }

    // Mock the RequestSignatureGuard
    const mockRequestSignatureGuard = {
      canActivate: jest.fn().mockReturnValue(true),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DynamicConfigController],
      providers: [
        {
          provide: DynamicConfigService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(RequestSignatureGuard)
      .useValue(mockRequestSignatureGuard)
      .compile()

    controller = module.get<DynamicConfigController>(DynamicConfigController)
    service = module.get(DynamicConfigService)

    // Reset all mocks to ensure clean state
    jest.clearAllMocks()

    // Setup default mock returns
    mockRequest.get.mockReturnValue('Mozilla/5.0')
  })

  describe('getAllConfigurations', () => {
    it('should return paginated configurations', async () => {
      const query: ConfigurationQueryDTO = {
        page: 1,
        limit: 10,
        type: ConfigurationType.STRING,
      }

      const mockResult = {
        data: [
          {
            key: 'test.key',
            value: 'test-value',
            type: ConfigurationType.STRING,
            isRequired: false,
            description: 'Test config',
            lastModified: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }

      service.getAllQuery.mockResolvedValue(mockResult)

      const result = await controller.getAllConfigurations(query)

      expect(service.getAllQuery).toHaveBeenCalledWith(query)
      expect(result.data).toHaveLength(1)
      expect(result.pagination).toEqual(mockResult.pagination)
    })

    it('should handle service errors', async () => {
      service.getAllQuery.mockRejectedValue(new Error('Database error'))

      await expect(controller.getAllConfigurations({})).rejects.toThrow(HttpException)
    })
  })

  describe('getConfiguration', () => {
    it('should return configuration by key', async () => {
      service.get.mockResolvedValue('test-value')
      ;(service as any).findByKey.mockResolvedValue(mockConfigDocument)

      const result = await controller.getConfiguration('test.key')

      expect(service.get).toHaveBeenCalledWith('test.key')
      expect(result.key).toBe('test.key')
      expect(result.value).toBe('test-value')
    })

    it('should throw 404 when configuration not found', async () => {
      service.get.mockResolvedValue(null)

      await expect(controller.getConfiguration('nonexistent.key')).rejects.toThrow(
        new HttpException('Configuration not found: nonexistent.key', HttpStatus.NOT_FOUND),
      )
    })

    it('should throw 404 when config document not found', async () => {
      service.get.mockResolvedValue('test-value')
      service.findByKey.mockResolvedValue(null)

      await expect(controller.getConfiguration('test.key')).rejects.toThrow(
        new HttpException('Configuration not found: test.key', HttpStatus.NOT_FOUND),
      )
    })

    it('should handle service errors', async () => {
      service.get.mockRejectedValue(new Error('Database error'))

      await expect(controller.getConfiguration('test.key')).rejects.toThrow(HttpException)
    })
  })

  describe('createConfiguration', () => {
    const createDTO: CreateConfigurationDTO = {
      key: 'new.key',
      value: 'new-value',
      type: ConfigurationType.STRING,
      description: 'New configuration',
    }

    it('should create configuration successfully', async () => {
      service.exists.mockResolvedValue(false)
      service.create.mockResolvedValue(mockConfigDocument as any)

      const result = await controller.createConfiguration(createDTO, mockRequest)

      expect(service.exists).toHaveBeenCalledWith('new.key')
      expect(service.create).toHaveBeenCalledWith(
        createDTO,
        '0x1234567890123456789012345678901234567890',
        'Mozilla/5.0',
      )
      expect(result.key).toBe(mockConfigDocument.key)
    })

    it('should throw 409 when configuration already exists', async () => {
      service.exists.mockResolvedValue(true)

      await expect(controller.createConfiguration(createDTO, mockRequest)).rejects.toThrow(
        new HttpException('Configuration already exists: new.key', HttpStatus.CONFLICT),
      )
    })

    it('should handle validation errors', async () => {
      service.exists.mockResolvedValue(false)
      service.create.mockRejectedValue(new Error('Configuration validation failed: Invalid value'))

      await expect(controller.createConfiguration(createDTO, mockRequest)).rejects.toThrow(
        new HttpException('Configuration validation failed: Invalid value', HttpStatus.BAD_REQUEST),
      )
    })

    it('should handle service errors', async () => {
      service.exists.mockResolvedValue(false)
      service.create.mockRejectedValue(new Error('Database error'))

      await expect(controller.createConfiguration(createDTO, mockRequest)).rejects.toThrow(
        HttpException,
      )
    })
  })

  describe('updateConfiguration', () => {
    const updateDTO: UpdateConfigurationDTO = {
      value: 'updated-value',
      description: 'Updated configuration',
    }

    it('should update configuration successfully', async () => {
      const updatedConfig = {
        ...mockConfigDocument,
        value: 'updated-value',
        description: 'Updated configuration',
      }
      service.update.mockResolvedValue(updatedConfig as any)

      const result = await controller.updateConfiguration('test.key', updateDTO, mockRequest)

      expect(service.update).toHaveBeenCalledWith(
        'test.key',
        updateDTO,
        '0x1234567890123456789012345678901234567890',
        'Mozilla/5.0',
      )
      expect(result.key).toBe('test.key')
      expect(result.value).toBe('updated-value')
    })

    it('should throw 404 when configuration not found', async () => {
      service.update.mockResolvedValue(null)

      await expect(
        controller.updateConfiguration('nonexistent.key', updateDTO, mockRequest),
      ).rejects.toThrow(
        new HttpException('Configuration not found: nonexistent.key', HttpStatus.NOT_FOUND),
      )
    })

    it('should handle validation errors', async () => {
      service.update.mockRejectedValue(new Error('Configuration validation failed: Invalid type'))

      await expect(
        controller.updateConfiguration('test.key', updateDTO, mockRequest),
      ).rejects.toThrow(
        new HttpException('Configuration validation failed: Invalid type', HttpStatus.BAD_REQUEST),
      )
    })

    it('should handle service errors', async () => {
      service.update.mockRejectedValue(new Error('Database error'))

      await expect(
        controller.updateConfiguration('test.key', updateDTO, mockRequest),
      ).rejects.toThrow(HttpException)
    })
  })

  describe('deleteConfiguration', () => {
    it('should delete configuration successfully', async () => {
      service.delete.mockResolvedValue(true)

      const result = await controller.deleteConfiguration('test.key', mockRequest)

      expect(service.delete).toHaveBeenCalledWith(
        'test.key',
        '0x1234567890123456789012345678901234567890',
        'Mozilla/5.0',
      )
      expect(result.message).toBe('Configuration deleted successfully: test.key')
    })

    it('should throw 404 when configuration not found', async () => {
      service.delete.mockResolvedValue(false)

      await expect(controller.deleteConfiguration('nonexistent.key', mockRequest)).rejects.toThrow(
        new HttpException('Configuration not found: nonexistent.key', HttpStatus.NOT_FOUND),
      )
    })

    it('should handle required configuration error', async () => {
      service.delete.mockRejectedValue(new Error('Cannot delete required configuration: test.key'))

      await expect(controller.deleteConfiguration('test.key', mockRequest)).rejects.toThrow(
        new HttpException('Cannot delete required configuration: test.key', HttpStatus.BAD_REQUEST),
      )
    })

    it('should handle service errors', async () => {
      service.delete.mockRejectedValue(new Error('Database error'))

      await expect(controller.deleteConfiguration('test.key', mockRequest)).rejects.toThrow(
        HttpException,
      )
    })
  })

  describe('getConfigurationAuditHistory', () => {
    const query: AuditQueryDTO = {
      limit: 10,
      offset: 0,
    }

    it('should return audit history successfully', async () => {
      service.exists.mockResolvedValue(true)
      service.getAuditHistory.mockResolvedValue(mockAuditLogsResponse as any)

      const result = await controller.getConfigurationAuditHistory('test.key', query)

      expect(service.exists).toHaveBeenCalledWith('test.key')
      expect(service.getAuditHistory).toHaveBeenCalledWith('test.key', 10, 0)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].configKey).toBe('test.key')
    })

    it('should return audit history count successfully', async () => {
      service.exists.mockResolvedValue(true)
      service.getAuditHistory.mockResolvedValue(mockAuditLogsResponse as any)
      service.getAuditHistoryCountForKey.mockResolvedValue(9494)

      const result = await controller.getConfigurationAuditHistory('test.key', query)
      expect(result.total).toEqual(9494)
    })

    it('should throw 404 when configuration not found', async () => {
      service.exists.mockResolvedValue(false)

      await expect(
        controller.getConfigurationAuditHistory('nonexistent.key', query),
      ).rejects.toThrow(
        new HttpException('Configuration not found: nonexistent.key', HttpStatus.NOT_FOUND),
      )
    })

    it('should handle service errors', async () => {
      service.exists.mockResolvedValue(true)
      service.getAuditHistory.mockRejectedValue(new Error('Database error'))

      await expect(controller.getConfigurationAuditHistory('test.key', query)).rejects.toThrow(
        HttpException,
      )
    })
  })

  describe('helper methods', () => {
    describe('getUserContext', () => {
      it('should extract user context from request headers', () => {
        const userContext = (controller as any).getUserContext(mockRequest)
        expect(userContext.userId).toBe('0x1234567890123456789012345678901234567890')
        expect(userContext.userAgent).toBe('Mozilla/5.0')
      })
    })

    describe('toResponseDTO', () => {
      it('should transform config to response DTO', () => {
        const config = {
          _id: 'test-id',
          key: 'test.key',
          value: 'test-value',
          type: ConfigurationType.STRING,
          isRequired: false,
          description: 'Test config',
          lastModifiedBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const result = (controller as any).toResponseDTO(config)

        expect(result.id).toBe('test-id')
        expect(result.key).toBe('test.key')
        expect(result.value).toBe('test-value')
        expect(result.type).toBe('string')
      })
    })

    describe('toAuditResponseDTO', () => {
      it('should transform audit log to response DTO', () => {
        const result = (controller as any).toAuditResponseDTO(mockAuditLogsResponse.logs[0])

        expect(result.id).toBe('mock-audit-id')
        expect(result.configKey).toBe('test.key')
        expect(result.operation).toBe('CREATE')
        expect(result.userId).toBe('test-user-id')
      })
    })
  })
})
