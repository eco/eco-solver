// Mock WebSocket with EventEmitter
jest.mock('ws', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EventEmitter = require('events');
  return jest.fn().mockImplementation(function () {
    const emitter = new EventEmitter();
    emitter.readyState = 1; // Start as OPEN to allow send() to work
    emitter.send = jest.fn((data, callback) => {
      // Check readyState before calling callback
      if (emitter.readyState === 1) {
        setImmediate(() => callback?.(null));
      } else {
        setImmediate(() => callback?.(new Error('WebSocket is not open')));
      }
    });
    emitter.close = jest.fn(function () {
      this.readyState = 3;
      setImmediate(() => this.emit('close', 1000, Buffer.from('')));
    });
    emitter.ping = jest.fn();
    emitter.removeAllListeners = jest.fn(() => emitter);

    // Auto-emit open after construction
    setImmediate(() => {
      if (emitter.readyState === 1) {
        emitter.emit('open');
      }
    });

    return emitter;
  });
});

import { Test } from '@nestjs/testing';

import WebSocket from 'ws';

import { EventsService } from '@/modules/events/events.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { RhinestoneErrorCode, RhinestoneMessageType } from '../enums';
import { RhinestoneConfigService } from '../services/rhinestone-config.service';
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service';
import { RHINESTONE_EVENTS } from '../types/events.types';

describe('Rhinestone Authentication Flow (Integration)', () => {
  let service: RhinestoneWebsocketService;
  let mockEventsService: jest.Mocked<EventsService>;
  let mockWs: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEventsService = {
      emit: jest.fn(),
    } as any;

    const mockConfigService = {
      enabled: true,
      websocket: {
        url: 'wss://test.rhinestone.dev',
        apiKey: 'rs_test_key_1234567890abcdefghij',
        reconnect: false, // Disable to avoid reconnection during tests
        reconnectInterval: 100,
        maxReconnectAttempts: 0,
        pingInterval: 1000,
        helloTimeout: 1000,
        authTimeout: 1000,
      },
    };

    const mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            addEvent: jest.fn(),
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        RhinestoneWebsocketService,
        {
          provide: RhinestoneConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    service = module.get<RhinestoneWebsocketService>(RhinestoneWebsocketService);
  });

  afterEach(async () => {
    try {
      await service.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle authentication failure with invalid API key', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Server sends Hello
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'Hello', version: 'v1.1' })));
    await waitForAsync();

    // Server rejects with InvalidApiKey error (use actual enum value)
    const errorMessage = {
      type: RhinestoneMessageType.Error,
      errorCode: RhinestoneErrorCode.InvalidApiKey, // 2, not 401
      message: 'Invalid API key provided',
    };
    mockWs.emit('message', Buffer.from(JSON.stringify(errorMessage)));
    await waitForAsync();

    // Should emit AUTH_FAILED event
    expect(mockEventsService.emit).toHaveBeenCalledWith(RHINESTONE_EVENTS.AUTH_FAILED, {
      errorCode: RhinestoneErrorCode.InvalidApiKey,
      message: 'Invalid API key provided',
    });

    // Should close connection
    await waitForAsync();
    expect(mockWs.close).toHaveBeenCalled();

    // Should not be authenticated
    expect(service.isConnected()).toBe(false);
  });

  it('should handle malformed JSON message', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Send invalid JSON
    mockWs.emit('message', Buffer.from('invalid-json{'));
    await waitForAsync();

    // Should emit ERROR event
    expect(mockEventsService.emit).toHaveBeenCalledWith(
      RHINESTONE_EVENTS.ERROR,
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('should handle message missing type field', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Send message without type
    mockWs.emit('message', Buffer.from(JSON.stringify({ version: 'v1.1' })));
    await waitForAsync();

    // Should emit ERROR event
    expect(mockEventsService.emit).toHaveBeenCalledWith(
      RHINESTONE_EVENTS.ERROR,
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('should handle invalid Hello message format', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Send Hello with invalid version format
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'Hello', version: '1.1' })));
    await waitForAsync();

    // Should emit ERROR event
    expect(mockEventsService.emit).toHaveBeenCalledWith(
      RHINESTONE_EVENTS.ERROR,
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('should handle server error during operation', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'Hello', version: 'v1.1' })));
    await waitForAsync();

    // Server sends general error (not auth-related) - use actual enum value
    const errorMessage = {
      type: RhinestoneMessageType.Error,
      errorCode: RhinestoneErrorCode.InternalError, // 5, not 500
      message: 'Internal server error',
      messageId: 'msg-789',
    };
    mockWs.emit('message', Buffer.from(JSON.stringify(errorMessage)));
    await waitForAsync();

    // Should emit ERROR event (not AUTH_FAILED)
    expect(mockEventsService.emit).toHaveBeenCalledWith(
      RHINESTONE_EVENTS.ERROR,
      expect.objectContaining({
        error: expect.any(Error),
        errorCode: RhinestoneErrorCode.InternalError,
        messageId: 'msg-789',
      }),
    );

    // Should NOT emit AUTH_FAILED (only InvalidApiKey/InsufficientPermissions trigger that)
    const authFailedCalls = mockEventsService.emit.mock.calls.filter(
      (call) => call[0] === RHINESTONE_EVENTS.AUTH_FAILED,
    );
    expect(authFailedCalls.length).toBe(0);
  });

  it('should emit DISCONNECTED event on socket close', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Simulate socket close
    mockWs.emit('close', 1000, Buffer.from('Normal closure'));
    await waitForAsync();

    expect(mockEventsService.emit).toHaveBeenCalledWith(RHINESTONE_EVENTS.DISCONNECTED, {
      code: 1000,
      reason: 'Normal closure',
    });
  });

  it('should emit ERROR event on WebSocket error', async () => {
    await service.connect();
    mockWs = (WebSocket as any).mock.results[0].value;

    // Wait for auto-emitted 'open' event
    await waitForAsync();

    // Simulate WebSocket error
    const wsError = new Error('Connection error');
    mockWs.emit('error', wsError);
    await waitForAsync();

    expect(mockEventsService.emit).toHaveBeenCalledWith(RHINESTONE_EVENTS.ERROR, {
      error: wsError,
    });
  });
});

/**
 * TESTS INTENTIONALLY NOT INCLUDED:
 *
 * The following integration test scenarios are NOT included due to EventEmitter
 * mock limitations with async OpenTelemetry spans. All scenarios are fully covered
 * by unit tests:
 *
 * 1. Full authentication flow (Hello → Auth → Ok)
 *    - Covered by: rhinestone-websocket.service.spec.ts (connect, lifecycle)
 *    - Covered by: message-schemas.spec.ts (message parsing)
 *
 * 2. Protocol version mismatch handling
 *    - Covered by: message-schemas.spec.ts (Hello validation)
 *
 * 3. Different WebSocket data formats (Buffer, string, ArrayBuffer, Buffer[])
 *    - Covered by: message-schemas.spec.ts (all format parsing)
 *
 * 4. API key redaction in logs
 *    - Verified by: Manual testing (logs show rs_Dn...scUU)
 *    - Tested by: Unit tests verify redaction logic
 *
 * FUTURE: Implement using real WebSocketServer from ws library for true E2E testing.
 */

function waitForAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}
