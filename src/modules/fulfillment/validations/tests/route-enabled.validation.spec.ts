import { Test, TestingModule } from '@nestjs/testing';

import * as api from '@opentelemetry/api';

import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { ValidationErrorType } from '@/modules/fulfillment/enums/validation-error-type.enum';
import { ValidationError } from '@/modules/fulfillment/errors/validation.error';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { RouteEnabledValidation } from '@/modules/fulfillment/validations/route-enabled.validation';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { createMockIntent, createMockValidationContext } from '../test-helpers';

interface MockConfigService {
  getStrategyRouteEnablementConfig: jest.Mock;
  routeEnablementConfig: any;
  _routeEnablementConfig: any;
}

describe('RouteEnabledValidation', () => {
  let validation: RouteEnabledValidation;
  let configService: MockConfigService;
  let otelService: jest.Mocked<OpenTelemetryService>;
  let context: ValidationContext;

  const mockSpan = {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  };

  beforeEach(async () => {
    const mockConfigService: MockConfigService = {
      getStrategyRouteEnablementConfig: jest.fn(),
      get routeEnablementConfig() {
        return this._routeEnablementConfig;
      },
      _routeEnablementConfig: undefined,
    };

    configService = mockConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteEnabledValidation,
        {
          provide: FulfillmentConfigService,
          useValue: mockConfigService,
        },
        {
          provide: OpenTelemetryService,
          useValue: {
            tracer: {
              startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
                const span = {
                  setAttribute: jest.fn(),
                  setAttributes: jest.fn(),
                  addEvent: jest.fn(),
                  setStatus: jest.fn(),
                  recordException: jest.fn(),
                  end: jest.fn(),
                };
                return fn(span);
              }),
            },
          },
        },
      ],
    }).compile();

    validation = module.get<RouteEnabledValidation>(RouteEnabledValidation);
    otelService = module.get(OpenTelemetryService);
    context = createMockValidationContext();

    // Reset all mocks
    jest.clearAllMocks();
    jest.spyOn(api.trace, 'getActiveSpan').mockReturnValue(undefined);
  });

  describe('No configuration (default behavior)', () => {
    it('should allow all routes when no configuration exists', async () => {
      // No configuration set
      configService._routeEnablementConfig = undefined;
      configService.getStrategyRouteEnablementConfig.mockReturnValue(undefined);

      const intent = createMockIntent({
        sourceChainId: BigInt(1), // Ethereum
        destination: BigInt(10), // Optimism
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.config.exists', false);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.enabled', true);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: api.SpanStatusCode.OK });
    });
  });

  describe('Whitelist mode', () => {
    it('should allow routes that are in the whitelist', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10', '10:1'],
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.enabled', true);
    });

    it('should block routes that are not in the whitelist', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10'], // Only Ethereum to Optimism allowed
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(10), // Optimism
        destination: BigInt(1), // Ethereum (reverse direction)
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Route 10:1 is not in whitelist',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.enabled', false);
    });

    it('should allow routes with chain type wildcards', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['evm:evm'], // All EVM to EVM transfers allowed
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1), // Ethereum (EVM)
        destination: BigInt(10), // Optimism (EVM)
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.source.type', 'evm');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.destination.type', 'evm');
    });

    it('should handle mixed wildcard and specific chain IDs', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['evm:10'], // Any EVM chain to Optimism
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1), // Ethereum (EVM)
        destination: BigInt(10), // Optimism
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
    });

    it('should handle Solana chain type', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['svm:evm'], // Solana to EVM allowed
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1399811149), // Solana mainnet
        destination: BigInt(1), // Ethereum
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.source.type', 'svm');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.destination.type', 'evm');
    });
  });

  describe('Blacklist mode', () => {
    it('should allow routes that are not in the blacklist', async () => {
      configService._routeEnablementConfig = {
        mode: 'blacklist',
        routes: ['1:10'], // Block Ethereum to Optimism
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(10), // Optimism
        destination: BigInt(1), // Ethereum (different route)
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
    });

    it('should block routes that are in the blacklist', async () => {
      configService._routeEnablementConfig = {
        mode: 'blacklist',
        routes: ['1:10'], // Block Ethereum to Optimism
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1), // Ethereum
        destination: BigInt(10), // Optimism
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Route 1:10 is blacklisted',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });

    it('should block routes with chain type wildcards', async () => {
      configService._routeEnablementConfig = {
        mode: 'blacklist',
        routes: ['svm:evm'], // Block all Solana to EVM transfers
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1399811149), // Solana mainnet
        destination: BigInt(1), // Ethereum
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Route 1399811149:1 is blacklisted',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });
  });

  describe('Strategy-specific configuration', () => {
    it('should use strategy-specific config over global config', async () => {
      // Global config blocks the route
      configService._routeEnablementConfig = {
        mode: 'blacklist',
        routes: ['1:10'],
      };

      // Strategy-specific config allows it
      configService.getStrategyRouteEnablementConfig.mockReturnValue({
        mode: 'whitelist',
        routes: ['1:10'],
      });

      const intent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(configService.getStrategyRouteEnablementConfig).toHaveBeenCalledWith('standard');
    });

    it('should fall back to global config if no strategy config exists', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10'],
      };
      configService.getStrategyRouteEnablementConfig.mockReturnValue(undefined);

      const intent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
    });
  });

  describe('Bi-directional route requirement', () => {
    it('should not automatically allow reverse routes', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10'], // Only Ethereum to Optimism
      };

      // Test forward direction (allowed)
      const forwardIntent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      const forwardResult = await validation.validate(forwardIntent, context);
      expect(forwardResult).toBe(true);

      // Test reverse direction (not allowed)
      const reverseIntent = createMockIntent({
        sourceChainId: BigInt(10),
        destination: BigInt(1),
      });

      await expect(validation.validate(reverseIntent, context)).rejects.toThrow(
        new ValidationError(
          'Route 10:1 is not in whitelist',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });

    it('should allow both directions when explicitly configured', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10', '10:1'], // Both directions explicitly allowed
      };

      // Test forward direction
      const forwardIntent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      const forwardResult = await validation.validate(forwardIntent, context);
      expect(forwardResult).toBe(true);

      // Test reverse direction
      const reverseIntent = createMockIntent({
        sourceChainId: BigInt(10),
        destination: BigInt(1),
      });

      const reverseResult = await validation.validate(reverseIntent, context);
      expect(reverseResult).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw error if source chain ID is missing', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10'],
      };

      const intent = createMockIntent({
        sourceChainId: undefined as any,
        destination: BigInt(10),
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Intent must have source chain ID',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });

    it('should throw error if destination chain ID is missing', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['1:10'],
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: undefined as any,
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Intent must have destination chain ID',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });

    it('should handle invalid route format gracefully', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['invalid-format', '1-10', 'missing:colon:extra'], // Invalid formats
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(1),
        destination: BigInt(10),
      });

      await expect(validation.validate(intent, context)).rejects.toThrow(
        new ValidationError(
          'Route 1:10 is not in whitelist',
          ValidationErrorType.PERMANENT,
          'RouteEnabledValidation',
        ),
      );
    });
  });

  describe('Complex route patterns', () => {
    it('should handle multiple allowed routes', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: [
          'evm:evm', // All EVM to EVM
          'svm:1', // Solana to Ethereum specifically
          '10:8453', // Optimism to Base specifically
        ],
      };

      // Test EVM to EVM
      const evmIntent = createMockIntent({
        sourceChainId: BigInt(42161), // Arbitrum
        destination: BigInt(137), // Polygon
      });
      expect(await validation.validate(evmIntent, context)).toBe(true);

      // Test Solana to Ethereum
      const svmIntent = createMockIntent({
        sourceChainId: BigInt(1399811149), // Solana
        destination: BigInt(1), // Ethereum
      });
      expect(await validation.validate(svmIntent, context)).toBe(true);

      // Test specific route
      const specificIntent = createMockIntent({
        sourceChainId: BigInt(10), // Optimism
        destination: BigInt(8453), // Base
      });
      expect(await validation.validate(specificIntent, context)).toBe(true);
    });

    it('should handle Tron (TVM) chain type', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: ['tvm:evm'], // Tron to EVM allowed
      };

      const intent = createMockIntent({
        sourceChainId: BigInt(728126428), // Tron mainnet
        destination: BigInt(1), // Ethereum
      });

      const result = await validation.validate(intent, context);

      expect(result).toBe(true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('route.source.type', 'tvm');
    });
  });

  describe('OpenTelemetry tracing', () => {
    it('should use active span if available', async () => {
      const activeSpan = { setAttribute: jest.fn() } as any;
      jest.spyOn(api.trace, 'getActiveSpan').mockReturnValue(activeSpan);

      const intent = createMockIntent();
      await validation.validate(intent, context);

      expect(otelService.tracer.startActiveSpan).not.toHaveBeenCalled();
      expect(mockSpan.end).not.toHaveBeenCalled();
    });

    it('should create new span if no active span', async () => {
      jest.spyOn(api.trace, 'getActiveSpan').mockReturnValue(undefined);

      const intent = createMockIntent();
      await validation.validate(intent, context);

      expect(otelService.tracer.startActiveSpan).toHaveBeenCalledWith(
        'validation.RouteEnabledValidation',
        {
          attributes: {
            'validation.name': 'RouteEnabledValidation',
            'intent.hash': intent.intentHash,
            'intent.source_chain': intent.sourceChainId?.toString(),
            'intent.destination_chain': intent.destination?.toString(),
          },
        },
        expect.any(Function),
      );
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record exception on error', async () => {
      configService._routeEnablementConfig = {
        mode: 'whitelist',
        routes: [],
      };

      const intent = createMockIntent();

      try {
        await validation.validate(intent, context);
      } catch (error) {
        // Expected error
      }

      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: api.SpanStatusCode.ERROR });
    });
  });
});
