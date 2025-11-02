import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
import { IntentStatus } from '@/common/interfaces/intent.interface';
import { toUniversalAddress } from '@/common/types/universal-address.type';
import { IntentFulfilledHandler } from '@/modules/fulfillment/handlers/intent-fulfilled.handler';
import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

describe('IntentFulfilledHandler', () => {
  let handler: IntentFulfilledHandler;
  let intentsService: jest.Mocked<IntentsService>;
  let logger: jest.Mocked<Logger>;
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
          provide: Logger,
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
            tracer: {
              startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
                const span = {
                  setAttribute: jest.fn(),
                  setAttributes: jest.fn(),
                  setStatus: jest.fn(),
                  addEvent: jest.fn(),
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

    handler = module.get<IntentFulfilledHandler>(IntentFulfilledHandler);
    intentsService = module.get(IntentsService);
    logger = module.get(Logger);
    otelService = module.get(OpenTelemetryService);
  });

  describe('handleIntentFulfilled', () => {
    const mockEvent: IntentFulfilledEvent = {
      intentHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
      claimant: toUniversalAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
      chainId: 1n,
      transactionHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      blockNumber: 12345678n,
      timestamp: new Date(),
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

      // The span is created and used within the callback, we just need to verify the tracer was called
      expect(otelService.tracer.startActiveSpan).toHaveBeenCalled();
    });

    it('should create proper OpenTelemetry span', async () => {
      const updatedIntent = { intentHash: mockEvent.intentHash, status: IntentStatus.FULFILLED };
      intentsService.updateStatus.mockResolvedValue(updatedIntent as any);

      await handler.handleIntentFulfilled(mockEvent);

      expect(otelService.tracer.startActiveSpan).toHaveBeenCalled();

      const mockStartActiveSpan = otelService.tracer.startActiveSpan as jest.Mock;
      const spanCall = mockStartActiveSpan.mock.calls[0];
      expect(spanCall[0]).toBe('fulfillment.handler.intentFulfilled');
      expect(spanCall[1]).toMatchObject({
        attributes: {
          'intent.hash': mockEvent.intentHash,
          'intent.claimant': mockEvent.claimant,
          'intent.chain_id': '1',
          'intent.transaction_hash': mockEvent.transactionHash,
          'intent.block_number': '12345678',
        },
      });
    });

    it('should handle event without blockNumber', async () => {
      const eventWithoutBlockNumber = { ...mockEvent, blockNumber: undefined };
      const updatedIntent = { intentHash: mockEvent.intentHash, status: IntentStatus.FULFILLED };
      intentsService.updateStatus.mockResolvedValue(updatedIntent as any);

      await handler.handleIntentFulfilled(eventWithoutBlockNumber);

      expect(otelService.tracer.startActiveSpan).toHaveBeenCalled();

      const mockStartActiveSpan = otelService.tracer.startActiveSpan as jest.Mock;
      const spanCall = mockStartActiveSpan.mock.calls[0];
      expect(spanCall[0]).toBe('fulfillment.handler.intentFulfilled');
      expect(spanCall[1]).toMatchObject({
        attributes: {
          'intent.hash': mockEvent.intentHash,
          'intent.claimant': mockEvent.claimant,
          'intent.chain_id': '1',
          'intent.transaction_hash': mockEvent.transactionHash,
          'intent.block_number': undefined,
        },
      });
    });
  });
});
