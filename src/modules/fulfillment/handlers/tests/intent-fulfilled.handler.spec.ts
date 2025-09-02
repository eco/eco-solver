import { Test, TestingModule } from '@nestjs/testing';

import { IntentStatus } from '@/common/interfaces/intent.interface';
import { IntentFulfilledEvent } from '@/modules/blockchain/evm/utils/events';
import { IntentFulfilledHandler } from '@/modules/fulfillment/handlers/intent-fulfilled.handler';
import { IntentsService } from '@/modules/intents/intents.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

describe('IntentFulfilledHandler', () => {
  let handler: IntentFulfilledHandler;
  let intentsService: jest.Mocked<IntentsService>;
  let logger: jest.Mocked<SystemLoggerService>;
  let otelService: jest.Mocked<OpenTelemetryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentFulfilledHandler,
        {
          provide: IntentsService,
          useValue: {
            updateStatus: jest.fn(),
          },
        },
        {
          provide: SystemLoggerService,
          useValue: {
            setContext: jest.fn(),
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: OpenTelemetryService,
          useValue: {
            startSpan: jest.fn().mockReturnValue({
              setStatus: jest.fn(),
              addEvent: jest.fn(),
              recordException: jest.fn(),
              end: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    handler = module.get<IntentFulfilledHandler>(IntentFulfilledHandler);
    intentsService = module.get(IntentsService);
    logger = module.get(SystemLoggerService);
    otelService = module.get(OpenTelemetryService);
  });

  describe('handleIntentFulfilled', () => {
    const mockEvent: IntentFulfilledEvent = {
      intentHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
      claimant: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      chainId: 1n,
      transactionHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      blockNumber: 12345678n,
    };

    it('should update intent status to FULFILLED', async () => {
      const updatedIntent = { intentHash: mockEvent.intentHash, status: IntentStatus.FULFILLED };
      intentsService.updateStatus.mockResolvedValue(updatedIntent as any);

      await handler.handleIntentFulfilled(mockEvent);

      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockEvent.intentHash,
        IntentStatus.FULFILLED,
        {
          lastProcessedAt: expect.any(Date),
          fulfilledTxHash: mockEvent.transactionHash,
        },
      );

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing IntentFulfilled event'),
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully updated intent'),
      );
    });

    it('should log warning when intent not found', async () => {
      intentsService.updateStatus.mockResolvedValue(null);

      await handler.handleIntentFulfilled(mockEvent);

      expect(intentsService.updateStatus).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Intent ' + mockEvent.intentHash + ' not found'),
      );
    });

    it('should handle errors and rethrow', async () => {
      const error = new Error('Database error');
      intentsService.updateStatus.mockRejectedValue(error);

      await expect(handler.handleIntentFulfilled(mockEvent)).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error processing IntentFulfilled event'),
        error,
      );

      const span = otelService.startSpan.mock.results[0].value;
      expect(span.recordException).toHaveBeenCalledWith(error);
      expect(span.setStatus).toHaveBeenCalledWith({
        code: expect.any(Number),
        message: 'Database error',
      });
    });

    it('should create proper OpenTelemetry span', async () => {
      const updatedIntent = { intentHash: mockEvent.intentHash, status: IntentStatus.FULFILLED };
      intentsService.updateStatus.mockResolvedValue(updatedIntent as any);

      await handler.handleIntentFulfilled(mockEvent);

      expect(otelService.startSpan).toHaveBeenCalledWith('fulfillment.handler.intentFulfilled', {
        attributes: {
          'intent.hash': mockEvent.intentHash,
          'intent.claimant': mockEvent.claimant,
          'intent.chain_id': '1',
          'intent.tx_hash': mockEvent.transactionHash,
          'intent.block_number': '12345678',
        },
      });

      const span = otelService.startSpan.mock.results[0].value;
      expect(span.addEvent).toHaveBeenCalledWith('intent.status.updated', {
        status: IntentStatus.FULFILLED,
        txHash: mockEvent.transactionHash,
      });
      expect(span.setStatus).toHaveBeenCalledWith({ code: expect.any(Number) });
      expect(span.end).toHaveBeenCalled();
    });

    it('should handle event without blockNumber', async () => {
      const eventWithoutBlockNumber = { ...mockEvent, blockNumber: undefined };
      const updatedIntent = { intentHash: mockEvent.intentHash, status: IntentStatus.FULFILLED };
      intentsService.updateStatus.mockResolvedValue(updatedIntent as any);

      await handler.handleIntentFulfilled(eventWithoutBlockNumber);

      expect(otelService.startSpan).toHaveBeenCalledWith('fulfillment.handler.intentFulfilled', {
        attributes: {
          'intent.hash': mockEvent.intentHash,
          'intent.claimant': mockEvent.claimant,
          'intent.chain_id': '1',
          'intent.tx_hash': mockEvent.transactionHash,
          'intent.block_number': undefined,
        },
      });
    });
  });
});
