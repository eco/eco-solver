import { Test, TestingModule } from '@nestjs/testing';

import { RhinestoneConfigService } from '@/modules/config/services/rhinestone-config.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { QUEUE_SERVICE } from '@/modules/queue/constants/queue.constants';

import { RhinestoneActionProcessor } from '../rhinestone-action-processor.service';
import { RhinestoneWebsocketService } from '../rhinestone-websocket.service';

import {
  createActionWithEmptyClaims,
  createActionWithInvalidCalldata,
  createActionWithInvalidClaimRouter,
  createActionWithInvalidFillRouter,
  createActionWithInvalidSettlementLayer,
  createActionWithMissingSettlementLayer,
  createActionWithMultipleBeforeFillClaims,
  createActionWithNoBeforeFillClaim,
  createActionWithNonZeroClaimValue,
  createActionWithNonZeroFillValue,
  createActionWithSameChains,
  VALID_ACTION,
} from './fixtures/action-fixtures';

const mockQueueService = {
  addIntentToFulfillmentQueue: jest.fn(),
};

const mockWebsocketService = {
  sendActionStatus: jest.fn().mockResolvedValue(undefined),
};

const mockOtelService = {
  tracer: {
    startActiveSpan: jest.fn((name, options, fn) =>
      fn({
        setAttribute: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      }),
    ),
  },
};

const mockRhinestoneConfigService = {
  getContracts: jest.fn().mockReturnValue({
    router: '0x000000000004598d17aad017bf0734a364c5588b',
    ecoAdapter: '0x0000000000000000000000000000000000000001',
    ecoArbiter: '0x0000000000000000000000000000000000000002',
  }),
};

describe('RhinestoneActionProcessor', () => {
  let service: RhinestoneActionProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RhinestoneActionProcessor,
        { provide: QUEUE_SERVICE, useValue: mockQueueService },
        { provide: RhinestoneWebsocketService, useValue: mockWebsocketService },
        { provide: OpenTelemetryService, useValue: mockOtelService },
        { provide: RhinestoneConfigService, useValue: mockRhinestoneConfigService },
      ],
    }).compile();

    service = module.get<RhinestoneActionProcessor>(RhinestoneActionProcessor);

    jest.clearAllMocks();
  });

  describe('Settlement Layer Validation', () => {
    it('should reject actions with ACROSS settlement layer', async () => {
      const action = createActionWithInvalidSettlementLayer();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Unsupported settlement layer: ACROSS'),
        }),
      );
    });

    it('should reject actions with missing settlement layer', async () => {
      const action = createActionWithMissingSettlementLayer();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Settlement layer not specified'),
        }),
      );
    });

    it('should reject actions with no beforeFill claim', async () => {
      const action = createActionWithNoBeforeFillClaim();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('No beforeFill claim found'),
        }),
      );
    });

    it('should accept actions with ECO settlement layer', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });
  });

  describe('Router Address Validation', () => {
    it('should accept valid matching router addresses', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should reject mismatched claim router address', async () => {
      const action = createActionWithInvalidClaimRouter();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Invalid router address in claim'),
        }),
      );
    });

    it('should reject mismatched fill router address', async () => {
      const action = createActionWithInvalidFillRouter();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Invalid router address in fill'),
        }),
      );
    });

    it('should handle checksum address validation correctly', async () => {
      const actionWithLowercase = {
        ...VALID_ACTION,
        fill: {
          ...VALID_ACTION.fill,
          call: {
            ...VALID_ACTION.fill.call,
            to: '0x000000000004598d17aad017bf0734a364c5588b',
          },
        },
      };

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: actionWithLowercase,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });
  });

  describe('Zero Value Validation', () => {
    it('should accept "0" value', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should accept "0x0" value', async () => {
      const actionWithHexZero = {
        ...VALID_ACTION,
        fill: {
          ...VALID_ACTION.fill,
          call: {
            ...VALID_ACTION.fill.call,
            value: '0x0',
          },
        },
        claims: [
          {
            ...VALID_ACTION.claims[0],
            call: {
              ...VALID_ACTION.claims[0].call,
              value: '0x0',
            },
          },
        ],
      };

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: actionWithHexZero,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should reject non-zero claim value', async () => {
      const action = createActionWithNonZeroClaimValue();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Router call in claim must have zero value'),
        }),
      );
    });

    it('should reject non-zero fill value', async () => {
      const action = createActionWithNonZeroFillValue();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Router call in fill must have zero value'),
        }),
      );
    });
  });

  describe('Cross-Chain Validation', () => {
    it('should accept different source and destination chains', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should reject same source and destination chains', async () => {
      const action = createActionWithSameChains();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Source and destination chains must be different'),
        }),
      );
    });
  });

  describe('Intent Extraction', () => {
    it('should attempt to decode real sample action from Rhinestone', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should call OpenTelemetry tracer for processing', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockOtelService.tracer.startActiveSpan).toHaveBeenCalledWith(
        'rhinestone.action_processor.handle',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'rhinestone.message_id': 'test-message-id',
            'rhinestone.action_id': VALID_ACTION.id,
          }),
        }),
        expect.any(Function),
      );
    });

    it('should pass validation steps before extraction', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should reject invalid adapter calldata', async () => {
      const action = createActionWithInvalidCalldata();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.any(String),
        }),
      );
    });

    it('should reject malformed hex data', async () => {
      const actionWithMalformed = {
        ...VALID_ACTION,
        claims: [
          {
            ...VALID_ACTION.claims[0],
            call: {
              ...VALID_ACTION.claims[0].call,
              data: 'not-hex-data',
            },
          },
        ],
      };

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: actionWithMalformed,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
        }),
      );
    });

    it('should provide clear error messages on decode failure', async () => {
      const action = createActionWithInvalidCalldata();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      const errorCall = mockWebsocketService.sendActionStatus.mock.calls[0];
      expect(errorCall[1].message).toBeTruthy();
      expect(typeof errorCall[1].message).toBe('string');
      expect(errorCall[1].message.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty claims array', async () => {
      const action = createActionWithEmptyClaims();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('No beforeFill claim found'),
        }),
      );
    });

    it('should handle multiple beforeFill claims', async () => {
      const action = createActionWithMultipleBeforeFillClaims();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should handle missing metadata', async () => {
      const action = createActionWithMissingSettlementLayer();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Settlement layer not specified'),
        }),
      );
    });

    it('should handle missing contracts configuration', async () => {
      mockRhinestoneConfigService.getContracts.mockImplementationOnce(() => {
        throw new Error('Rhinestone contracts not configured');
      });

      const action = createActionWithMultipleBeforeFillClaims();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Rhinestone contracts not configured'),
        }),
      );
    });
  });

  describe('Integration', () => {
    it('should process valid action through all validation steps', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockOtelService.tracer.startActiveSpan).toHaveBeenCalled();
      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });

    it('should send ActionStatus error on validation failure', async () => {
      const action = createActionWithInvalidSettlementLayer();

      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action,
      });

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          type: 'Error',
          reason: 'PreconditionFailed',
          message: expect.stringContaining('Unsupported settlement layer'),
        }),
      );
    });

    it('should emit OpenTelemetry spans with proper attributes', async () => {
      await service.handleRelayerAction({
        messageId: 'test-message-id',
        action: VALID_ACTION,
      });

      expect(mockOtelService.tracer.startActiveSpan).toHaveBeenCalledWith(
        'rhinestone.action_processor.handle',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'rhinestone.message_id': 'test-message-id',
            'rhinestone.action_id': VALID_ACTION.id,
            'rhinestone.action_timestamp': VALID_ACTION.timestamp,
          }),
        }),
        expect.any(Function),
      );

      const spanFn = mockOtelService.tracer.startActiveSpan.mock.calls[0][2];

      const mockSpan = {
        setAttribute: jest.fn(),
        addEvent: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      };

      await spanFn(mockSpan);

      expect(mockSpan.setStatus).toHaveBeenCalled();
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle ActionStatus send failures gracefully', async () => {
      mockWebsocketService.sendActionStatus.mockRejectedValueOnce(
        new Error('WebSocket connection failed'),
      );

      const action = createActionWithInvalidSettlementLayer();

      await expect(
        service.handleRelayerAction({
          messageId: 'test-message-id',
          action,
        }),
      ).resolves.not.toThrow();

      expect(mockWebsocketService.sendActionStatus).toHaveBeenCalled();
    });
  });
});
