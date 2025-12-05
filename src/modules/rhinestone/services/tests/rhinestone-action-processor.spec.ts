import { Test, TestingModule } from '@nestjs/testing';

import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QueueService } from '@/modules/queue/queue.service';

import { sampleAction } from '../../utils/tests/sample-action';
import { RhinestoneActionProcessor } from '../rhinestone-action-processor.service';
import { RhinestoneWebsocketService } from '../rhinestone-websocket.service';

describe('RhinestoneActionProcessor', () => {
  let service: RhinestoneActionProcessor;
  let intentsService: jest.Mocked<IntentsService>;
  let queueService: jest.Mocked<any>;
  let websocketService: jest.Mocked<RhinestoneWebsocketService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RhinestoneActionProcessor,
        {
          provide: RhinestoneWebsocketService,
          useValue: {
            sendActionStatus: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: IntentsService,
          useValue: {
            createIfNotExists: jest.fn().mockResolvedValue({ isNew: true }),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addRhinestoneActionToFulfillmentQueue: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<RhinestoneActionProcessor>(RhinestoneActionProcessor);
    intentsService = module.get(IntentsService);
    queueService = module.get(QueueService);
    websocketService = module.get(RhinestoneWebsocketService);

    jest.clearAllMocks();
  });

  describe('handleRelayerAction', () => {
    it('should process valid RelayerAction and queue to FulfillmentQueue', async () => {
      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await service.handleRelayerAction(payload);

      // Verify intents were stored in DB
      expect(intentsService.createIfNotExists).toHaveBeenCalled();

      // Verify action was queued to FULFILLMENT
      expect(queueService.addRhinestoneActionToFulfillmentQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rhinestone-action',
          strategy: 'rhinestone',
          messageId: 'test-message-123',
          actionId: expect.any(String),
          claims: expect.any(Array),
          fill: expect.objectContaining({
            intents: expect.any(Array),
            requiredApprovals: expect.any(Array),
            transaction: expect.any(Object),
          }),
          walletId: 'basic',
        }),
      );
    });

    it('should handle duplicate intents (retry support)', async () => {
      intentsService.createIfNotExists.mockResolvedValue({ isNew: false } as any);

      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await service.handleRelayerAction(payload);

      // Should still process
      expect(intentsService.createIfNotExists).toHaveBeenCalled();

      // Should queue to fulfillment (allows retries)
      expect(queueService.addRhinestoneActionToFulfillmentQueue).toHaveBeenCalled();
    });

    it('should send error status on processing failure', async () => {
      intentsService.createIfNotExists.mockRejectedValue(new Error('Database error'));

      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await expect(service.handleRelayerAction(payload)).rejects.toThrow('Database error');

      // Verify error status was sent
      expect(websocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-123',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: 'Database error',
        }),
      );

      // Verify action was NOT queued (error occurred before queueing)
      expect(queueService.addRhinestoneActionToFulfillmentQueue).not.toHaveBeenCalled();
    });

    it('should send error status on extraction failure', async () => {
      const invalidAction = {
        ...sampleAction.action,
        claims: [],
      } as any;

      const payload = {
        messageId: 'test-message-456',
        action: invalidAction,
      };

      await expect(service.handleRelayerAction(payload)).rejects.toThrow();

      // Verify error status was sent
      expect(websocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-456',
        expect.objectContaining({
          type: 'Error',
        }),
      );
    });
  });
});
