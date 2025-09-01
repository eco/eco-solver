import { Test, TestingModule } from '@nestjs/testing';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ValidationContext } from '@/modules/fulfillment/interfaces/validation-context.interface';
import { FulfillmentStrategy } from '@/modules/fulfillment/strategies/fulfillment-strategy.abstract';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { Validation } from '@/modules/fulfillment/validations';
import {
  FeeCalculationValidation,
  FeeDetails,
} from '@/modules/fulfillment/validations/fee-calculation.interface';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

// Test implementation of FulfillmentStrategy
class TestFulfillmentStrategy extends FulfillmentStrategy {
  readonly name: FulfillmentStrategyName = 'standard' as FulfillmentStrategyName;

  constructor(
    blockchainExecutor: BlockchainExecutorService,
    blockchainReader: BlockchainReaderService,
    otelService: OpenTelemetryService,
    private validations: ReadonlyArray<Validation>,
  ) {
    super(blockchainExecutor, blockchainReader, otelService);
  }

  canHandle(_intent: Intent): boolean {
    return true;
  }

  async execute(_intent: Intent): Promise<void> {
    // Test implementation
  }

  protected getValidations(): ReadonlyArray<Validation> {
    return this.validations;
  }
}

// Mock validation classes
class MockValidation implements Validation {
  constructor(
    private shouldPass: boolean = true,
    private errorMessage?: string,
  ) {}

  async validate(_intent: Intent, _context: ValidationContext): Promise<boolean> {
    if (!this.shouldPass && this.errorMessage) {
      throw new Error(this.errorMessage);
    }
    return this.shouldPass;
  }
}

class MockFeeValidation implements FeeCalculationValidation {
  constructor(
    private shouldPass: boolean = true,
    private feeDetails?: FeeDetails,
    private errorMessage?: string,
  ) {}

  async validate(_intent: Intent, _context: ValidationContext): Promise<boolean> {
    if (!this.shouldPass && this.errorMessage) {
      throw new Error(this.errorMessage);
    }
    return this.shouldPass;
  }

  async calculateFee(_intent: Intent, _context: ValidationContext): Promise<FeeDetails> {
    return (
      this.feeDetails || {
        baseFee: BigInt('1000000000000000'),
        percentageFee: BigInt('50000000000000'),
        totalRequiredFee: BigInt('1050000000000000'),
        currentReward: BigInt('5000000000000000000'),
        minimumRequiredReward: BigInt('1050000000000000'),
      }
    );
  }
}

describe('FulfillmentStrategy - getQuote', () => {
  let blockchainExecutor: BlockchainExecutorService;
  let blockchainReader: BlockchainReaderService;
  let otelService: OpenTelemetryService;

  const mockOtelService = {
    startSpan: jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
  };

  const mockIntent: Intent = createMockIntent();

  beforeEach(async () => {
    // Mock OpenTelemetry context API
    jest.spyOn(api.context, 'with').mockImplementation((_context, fn) => {
      return fn();
    });
    jest.spyOn(api.trace, 'setSpan').mockImplementation(() => api.context.active());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: BlockchainExecutorService,
          useValue: {},
        },
        {
          provide: BlockchainReaderService,
          useValue: {},
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    blockchainExecutor = module.get<BlockchainExecutorService>(BlockchainExecutorService);
    blockchainReader = module.get<BlockchainReaderService>(BlockchainReaderService);
    otelService = module.get<OpenTelemetryService>(OpenTelemetryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with all validations passing', () => {
    it('should return valid quote with fee details', async () => {
      const validations = [
        new MockValidation(true),
        new MockFeeValidation(true),
        new MockValidation(true),
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result).toEqual({
        valid: true,
        strategy: 'standard',
        fees: {
          baseFee: BigInt('1000000000000000'),
          percentageFee: BigInt('50000000000000'),
          totalRequiredFee: BigInt('1050000000000000'),
          currentReward: BigInt('5000000000000000000'),
          minimumRequiredReward: BigInt('1050000000000000'),
        },
        validationResults: [
          { validation: 'MockValidation', passed: true },
          { validation: 'MockFeeValidation', passed: true },
          { validation: 'MockValidation', passed: true },
        ],
      });
    });

    it('should handle multiple fee validations and use the first one', async () => {
      const firstFeeDetails: FeeDetails = {
        baseFee: BigInt('2000000000000000'),
        percentageFee: BigInt('100000000000000'),
        totalRequiredFee: BigInt('2100000000000000'),
        currentReward: BigInt('3000000000000000000'),
        minimumRequiredReward: BigInt('2100000000000000'),
      };

      const secondFeeDetails: FeeDetails = {
        baseFee: BigInt('3000000000000000'),
        percentageFee: BigInt('150000000000000'),
        totalRequiredFee: BigInt('3150000000000000'),
        currentReward: BigInt('4000000000000000000'),
        minimumRequiredReward: BigInt('3150000000000000'),
      };

      const validations = [
        new MockValidation(true),
        new MockFeeValidation(true, firstFeeDetails),
        new MockFeeValidation(true, secondFeeDetails),
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result.fees).toEqual(firstFeeDetails);
    });
  });

  describe('with validation failures', () => {
    it('should return invalid quote with error details', async () => {
      const validations = [
        new MockValidation(true),
        new MockValidation(false, 'Validation failed: insufficient balance'),
        new MockFeeValidation(true),
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result).toEqual({
        valid: false,
        strategy: 'standard',
        fees: {
          baseFee: BigInt('1000000000000000'),
          percentageFee: BigInt('50000000000000'),
          totalRequiredFee: BigInt('1050000000000000'),
          currentReward: BigInt('5000000000000000000'),
          minimumRequiredReward: BigInt('1050000000000000'),
        },
        validationResults: [
          { validation: 'MockValidation', passed: true },
          {
            validation: 'MockValidation',
            passed: false,
            error: 'Validation failed: insufficient balance',
          },
          { validation: 'MockFeeValidation', passed: true },
        ],
      });
    });

    it('should continue validating after failures to provide complete results', async () => {
      const validations = [
        new MockValidation(false, 'First validation failed'),
        new MockFeeValidation(false, undefined, 'Fee validation failed'),
        new MockValidation(true),
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result.valid).toBe(false);
      expect(result.validationResults).toHaveLength(3);
      expect(result.validationResults[0]).toEqual({
        validation: 'MockValidation',
        passed: false,
        error: 'First validation failed',
      });
      expect(result.validationResults[1]).toEqual({
        validation: 'MockFeeValidation',
        passed: false,
        error: 'Fee validation failed',
      });
      expect(result.validationResults[2]).toEqual({
        validation: 'MockValidation',
        passed: true,
      });
    });

    it('should handle validation returning false without throwing', async () => {
      const validations = [
        new MockValidation(false), // Returns false without error
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result.valid).toBe(false);
      expect(result.validationResults[0]).toEqual({
        validation: 'MockValidation',
        passed: false,
        error: 'Validation returned false',
      });
    });
  });

  describe('with no validations', () => {
    it('should return valid quote without fees', async () => {
      const validations: Validation[] = [];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result).toEqual({
        valid: true,
        strategy: 'standard',
        fees: undefined,
        validationResults: [],
      });
    });
  });

  describe('with validation throwing non-Error', () => {
    it('should handle non-Error exceptions', async () => {
      class ThrowingValidation implements Validation {
        async validate(_intent: Intent, _context: ValidationContext): Promise<boolean> {
          throw 'String error';
        }
      }

      const validations = [new ThrowingValidation()];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const result = await strategy.getQuote(mockIntent);

      expect(result.valid).toBe(false);
      expect(result.validationResults[0]).toEqual({
        validation: 'ThrowingValidation',
        passed: false,
        error: 'Unknown error',
      });
    });
  });

  describe('parallel execution', () => {
    it('should execute validations in parallel', async () => {
      const executionOrder: string[] = [];

      class SlowValidation implements Validation {
        constructor(
          private name: string,
          private delay: number,
        ) {}

        async validate(_intent: Intent, _context: ValidationContext): Promise<boolean> {
          executionOrder.push(`${this.name}-start`);
          await new Promise((resolve) => setTimeout(resolve, this.delay));
          executionOrder.push(`${this.name}-end`);
          return true;
        }
      }

      const validations = [
        new SlowValidation('validation1', 50),
        new SlowValidation('validation2', 30),
        new SlowValidation('validation3', 10),
      ];

      const strategy = new TestFulfillmentStrategy(
        blockchainExecutor,
        blockchainReader,
        otelService,
        validations,
      );

      const startTime = Date.now();
      await strategy.getQuote(mockIntent);
      const duration = Date.now() - startTime;

      // If validations ran sequentially, it would take 90ms+
      // In parallel, it should take around 50ms (the longest validation)
      expect(duration).toBeLessThan(80);

      // All validations should start before any finish
      expect(executionOrder).toEqual([
        'validation1-start',
        'validation2-start',
        'validation3-start',
        'validation3-end',
        'validation2-end',
        'validation1-end',
      ]);
    });
  });
});
