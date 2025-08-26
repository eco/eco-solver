import { Test } from '@nestjs/testing';

import { Address } from 'viem';

import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { ProverSupportValidation } from '../prover-support.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('ProverSupportValidation', () => {
  let validation: ProverSupportValidation;
  let proverService: any;

  beforeEach(async () => {
    const mockProverService = {
      validateIntentRoute: jest.fn(),
    };

    const mockOtelService = {
      startSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      }),
      getActiveSpan: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ProverSupportValidation,
        {
          provide: ProverService,
          useValue: mockProverService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<ProverSupportValidation>(ProverSupportValidation);
    proverService = module.get(ProverService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    describe('successful validation', () => {
      it('should return true when prover validates the route successfully', async () => {
        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(mockIntent);
      });

      it('should pass the entire intent to prover service', async () => {
        const complexIntent = createMockIntent({
          reward: {
            ...mockIntent.reward,
            tokens: [
              {
                token: '0x1111111111111111111111111111111111111111' as Address,
                amount: BigInt(100),
              },
              {
                token: '0x2222222222222222222222222222222222222222' as Address,
                amount: BigInt(200),
              },
            ],
          },
          route: {
            ...mockIntent.route,
            tokens: [
              {
                token: '0x3333333333333333333333333333333333333333' as Address,
                amount: BigInt(1000),
              },
            ],
            calls: [
              {
                target: '0x4444444444444444444444444444444444444444' as Address,
                data: '0xabcdef' as `0x${string}`,
                value: BigInt(500000000000000000),
              },
            ],
          },
        });

        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        await validation.validate(complexIntent, mockContext);

        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(complexIntent);
      });
    });

    describe('failed validation', () => {
      it('should throw error when prover rejects the route', async () => {
        proverService.validateIntentRoute.mockResolvedValue({
          isValid: false,
          reason: 'Route validation failed',
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Prover validation failed: Route validation failed',
        );

        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(mockIntent);
      });
    });

    describe('error handling', () => {
      it('should propagate errors from prover service', async () => {
        const error = new Error('Prover connection failed');
        proverService.validateIntentRoute.mockRejectedValue(error);

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(error);
      });

      it('should handle specific prover errors', async () => {
        const proverError = new Error('Invalid prover configuration for chain 1');
        proverService.validateIntentRoute.mockRejectedValue(proverError);

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(proverError);
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Prover validation timeout');
        proverService.validateIntentRoute.mockRejectedValue(timeoutError);

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(timeoutError);
      });
    });

    describe('different route configurations', () => {
      it('should validate cross-chain routes', async () => {
        const crossChainIntent = createMockIntent({
          route: {
            ...mockIntent.route,
            source: BigInt(1),
            destination: BigInt(137), // Ethereum to Polygon
          },
        });

        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        const result = await validation.validate(crossChainIntent, mockContext);

        expect(result).toBe(true);
        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(crossChainIntent);
      });

      it('should validate same-chain routes', async () => {
        const sameChainIntent = createMockIntent({
          route: {
            ...mockIntent.route,
            source: BigInt(1),
            destination: BigInt(1), // Same chain
          },
        });

        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        const result = await validation.validate(sameChainIntent, mockContext);

        expect(result).toBe(true);
        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(sameChainIntent);
      });

      it('should validate routes with large chain IDs', async () => {
        const largeChainIntent = createMockIntent({
          route: {
            ...mockIntent.route,
            source: BigInt(42161), // Arbitrum
            destination: BigInt(43114), // Avalanche
          },
        });

        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        const result = await validation.validate(largeChainIntent, mockContext);

        expect(result).toBe(true);
        expect(proverService.validateIntentRoute).toHaveBeenCalledWith(largeChainIntent);
      });
    });

    describe('prover edge cases', () => {
      it('should handle async prover validation', async () => {
        proverService.validateIntentRoute.mockImplementation(async () => {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { isValid: true };
        });

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
      });

      it('should call prover service exactly once per validation', async () => {
        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        await validation.validate(mockIntent, mockContext);

        expect(proverService.validateIntentRoute).toHaveBeenCalledTimes(1);
      });

      it('should not modify the intent object', async () => {
        const originalIntent = { ...mockIntent };
        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        await validation.validate(mockIntent, mockContext);

        expect(mockIntent).toEqual(originalIntent);
      });
    });

    describe('intent variations', () => {
      it('should handle intents with different prover addresses', async () => {
        const intentsWithDifferentProvers = [
          createMockIntent({
            reward: {
              ...mockIntent.reward,
              prover: '0x0000000000000000000000000000000000000001' as Address,
            },
          }),
          createMockIntent({
            reward: {
              ...mockIntent.reward,
              prover: '0xffffffffffffffffffffffffffffffffffffffff' as Address,
            },
          }),
        ];

        for (const intent of intentsWithDifferentProvers) {
          proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

          const result = await validation.validate(intent, mockContext);

          expect(result).toBe(true);
          expect(proverService.validateIntentRoute).toHaveBeenCalledWith(intent);
        }
      });

      it('should handle intents with various salt values', async () => {
        const intentWithDifferentSalt = createMockIntent({
          route: {
            ...mockIntent.route,
            salt: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`,
          },
        });

        proverService.validateIntentRoute.mockResolvedValue({ isValid: true });

        const result = await validation.validate(intentWithDifferentSalt, mockContext);

        expect(result).toBe(true);
      });
    });
  });
});
