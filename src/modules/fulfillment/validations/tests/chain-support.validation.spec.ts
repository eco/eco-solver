import { Test } from '@nestjs/testing';

import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
// Mock the blockchain executor service module before any imports
jest.mock('@/modules/blockchain/blockchain-executor.service', () => ({
  BlockchainExecutorService: jest.fn().mockImplementation(() => ({
    isChainSupported: jest.fn(),
  })),
}));

import { BlockchainExecutorService } from '@/modules/blockchain/blockchain-executor.service';

import { ChainSupportValidation } from '../chain-support.validation';
import { createMockIntent, createMockValidationContext } from '../test-helpers';

describe('ChainSupportValidation', () => {
  let validation: ChainSupportValidation;
  let blockchainExecutorService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockBlockchainExecutorService = {
      isChainSupported: jest.fn(),
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
        ChainSupportValidation,
        {
          provide: BlockchainExecutorService,
          useValue: mockBlockchainExecutorService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    validation = module.get<ChainSupportValidation>(ChainSupportValidation);
    blockchainExecutorService = module.get(BlockchainExecutorService);
  });

  describe('validate', () => {
    const mockIntent = createMockIntent();
    const mockContext = createMockValidationContext();

    describe('both chains supported', () => {
      it('should return true when both source and destination chains are supported', async () => {
        blockchainExecutorService.isChainSupported
          .mockReturnValueOnce(true) // source chain
          .mockReturnValueOnce(true); // destination chain

        const result = await validation.validate(mockIntent, mockContext);

        expect(result).toBe(true);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledTimes(2);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(1, BigInt(8453)); // Default sourceChainId from test helper
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(2, BigInt(10));
      });
    });

    describe('source chain not supported', () => {
      it('should throw error when source chain is not supported', async () => {
        blockchainExecutorService.isChainSupported.mockReturnValueOnce(false); // source chain isn't supported

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Source chain 8453 is not supported',
        );

        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledTimes(1);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledWith(BigInt(8453));
      });
    });

    describe('destination chain not supported', () => {
      it('should throw error when destination chain is not supported', async () => {
        blockchainExecutorService.isChainSupported
          .mockReturnValueOnce(true) // source chain supported
          .mockReturnValueOnce(false); // destination chain not supported

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Target chain 10 is not supported',
        );

        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledTimes(2);
      });
    });

    describe('both chains not supported', () => {
      it('should fail fast on source chain check', async () => {
        blockchainExecutorService.isChainSupported
          .mockReturnValueOnce(false) // source chain not supported
          .mockReturnValueOnce(false); // destination chain not supported (won't be called)

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(
          'Source chain 8453 is not supported',
        );

        // Should only check source chain and fail fast
        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledTimes(1);
      });
    });

    describe('different chain IDs', () => {
      it('should handle large chain IDs', async () => {
        const intentWithLargeChainIds = createMockIntent({
          sourceChainId: BigInt(1000000),
          destination: BigInt(9999999),
        });

        blockchainExecutorService.isChainSupported
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true);

        const result = await validation.validate(intentWithLargeChainIds, mockContext);

        expect(result).toBe(true);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(
          1,
          BigInt(1000000),
        );
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(
          2,
          BigInt(9999999),
        );
      });

      it('should handle same source and destination chains', async () => {
        const sameChainIntent = createMockIntent({
          sourceChainId: BigInt(1),
          destination: BigInt(1),
        });

        blockchainExecutorService.isChainSupported
          .mockReturnValueOnce(true) // source check
          .mockReturnValueOnce(true); // destination check

        const result = await validation.validate(sameChainIntent, mockContext);

        expect(result).toBe(true);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenCalledTimes(2);
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(1, BigInt(1));
        expect(blockchainExecutorService.isChainSupported).toHaveBeenNthCalledWith(2, BigInt(1));
      });

      it('should handle common chain IDs correctly', async () => {
        const commonChainIds = [
          { source: BigInt(1), destination: BigInt(137) }, // Ethereum to Polygon
          { source: BigInt(10), destination: BigInt(42161) }, // Optimism to Arbitrum
          { source: BigInt(56), destination: BigInt(250) }, // BSC to Fantom
        ];

        for (const { source, destination } of commonChainIds) {
          const intent = createMockIntent({
            sourceChainId: source,
            destination,
          });

          blockchainExecutorService.isChainSupported
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(true);

          const result = await validation.validate(intent, mockContext);

          expect(result).toBe(true);
        }
      });
    });

    describe('error propagation', () => {
      it('should propagate errors from blockchain executor service', async () => {
        const error = new Error('Service configuration error');
        blockchainExecutorService.isChainSupported.mockImplementation(() => {
          throw error;
        });

        await expect(validation.validate(mockIntent, mockContext)).rejects.toThrow(error);
      });
    });

    describe('validation order', () => {
      it('should check source chain before destination chain', async () => {
        const callOrder: string[] = [];

        blockchainExecutorService.isChainSupported.mockImplementation((chainId) => {
          callOrder.push(`chain-${chainId}`);
          return true;
        });

        await validation.validate(mockIntent, mockContext);

        expect(callOrder).toEqual(['chain-8453', 'chain-10']);
      });
    });
  });
});
