import { Test, TestingModule } from '@nestjs/testing';

import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';

import { RhinestoneActionProcessor } from '../rhinestone-action-processor.service';
import { RhinestoneMetadataService } from '../rhinestone-metadata.service';
import { RhinestoneValidationService } from '../rhinestone-validation.service';
import { RhinestoneWebsocketService } from '../rhinestone-websocket.service';
import { sampleAction } from '../../utils/tests/sample-action';

describe('RhinestoneActionProcessor', () => {
  let service: RhinestoneActionProcessor;
  let intentsService: jest.Mocked<IntentsService>;
  let metadataService: jest.Mocked<RhinestoneMetadataService>;
  let queueService: jest.Mocked<any>;
  let websocketService: jest.Mocked<RhinestoneWebsocketService>;
  let validationService: jest.Mocked<RhinestoneValidationService>;

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
          provide: RhinestoneValidationService,
          useValue: {
            validateSettlementLayerFromMetadata: jest.fn(),
            validateActionIntegrity: jest.fn(),
          },
        },
        {
          provide: IntentsService,
          useValue: {
            createIfNotExists: jest.fn().mockResolvedValue({ isNew: true }),
          },
        },
        {
          provide: RhinestoneMetadataService,
          useValue: {
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: QUEUE_SERVICE,
          useValue: {
            addIntentToFulfillmentQueue: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<RhinestoneActionProcessor>(RhinestoneActionProcessor);
    intentsService = module.get(IntentsService);
    metadataService = module.get(RhinestoneMetadataService);
    queueService = module.get(QUEUE_SERVICE);
    websocketService = module.get(RhinestoneWebsocketService);
    validationService = module.get(RhinestoneValidationService);

    jest.clearAllMocks();
  });

  describe('handleRelayerAction', () => {
    it('should process valid RelayerAction and queue to FulfillmentQueue', async () => {
      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await service.handleRelayerAction(payload);

      // Verify validation was called
      expect(validationService.validateSettlementLayerFromMetadata).toHaveBeenCalled();
      expect(validationService.validateActionIntegrity).toHaveBeenCalled();

      // Verify intent was stored in DB
      expect(intentsService.createIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.any(String),
        }),
      );

      // Verify metadata was stored in Redis
      expect(metadataService.set).toHaveBeenCalledWith(
        expect.any(String), // intentHash
        expect.objectContaining({
          claimTo: expect.any(String),
          claimData: expect.any(String),
          fillTo: expect.any(String),
          fillData: expect.any(String),
        }),
      );

      // Verify intent was queued to FulfillmentQueue
      expect(queueService.addIntentToFulfillmentQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          intentHash: expect.any(String),
        }),
        'rhinestone',
      );
    });

    it('should skip duplicate intents', async () => {
      intentsService.createIfNotExists.mockResolvedValue({ isNew: false } as any);

      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await service.handleRelayerAction(payload);

      // Should still validate and store
      expect(validationService.validateSettlementLayerFromMetadata).toHaveBeenCalled();
      expect(intentsService.createIfNotExists).toHaveBeenCalled();

      // But should NOT queue or store metadata for duplicates
      expect(metadataService.set).not.toHaveBeenCalled();
      expect(queueService.addIntentToFulfillmentQueue).not.toHaveBeenCalled();
    });

    it('should send error status on validation failure', async () => {
      validationService.validateSettlementLayerFromMetadata.mockImplementation(() => {
        throw new Error('Invalid settlement layer');
      });

      const payload = {
        messageId: 'test-message-123',
        action: sampleAction.action as any,
      };

      await expect(service.handleRelayerAction(payload)).rejects.toThrow(
        'Invalid settlement layer',
      );

      // Verify error status was sent
      expect(websocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-123',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: 'Invalid settlement layer',
        }),
      );

      // Verify intent was NOT queued
      expect(queueService.addIntentToFulfillmentQueue).not.toHaveBeenCalled();
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
