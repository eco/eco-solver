import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { RhinestoneConfigService } from '../rhinestone-config.service';

describe('RhinestoneConfigService', () => {
  let service: RhinestoneConfigService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        RhinestoneConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RhinestoneConfigService>(RhinestoneConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('websocket', () => {
    it('should return config with all values', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.rhinestone.dev',
              apiKey: 'rs_test_key_123',
              reconnect: true,
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
              pingInterval: 30000,
              helloTimeout: 2000,
              authTimeout: 2000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      const config = service.websocket;

      expect(config.url).toBe('wss://test.rhinestone.dev');
      expect(config.apiKey).toBe('rs_test_key_123');
      expect(config.reconnect).toBe(true);
      expect(config.reconnectInterval).toBe(5000);
      expect(config.maxReconnectAttempts).toBe(10);
      expect(config.pingInterval).toBe(30000);
      expect(config.helloTimeout).toBe(2000);
      expect(config.authTimeout).toBe(2000);
      expect(config.handshakeTimeout).toBe(5000);
    });

    it('should use custom reconnect interval', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.dev',
              apiKey: 'rs_key',
              reconnect: true,
              reconnectInterval: 10000,
              maxReconnectAttempts: 10,
              pingInterval: 30000,
              helloTimeout: 2000,
              authTimeout: 2000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      expect(service.websocket.reconnectInterval).toBe(10000);
    });

    it('should use custom timeout values', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.dev',
              apiKey: 'rs_key',
              reconnect: true,
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
              pingInterval: 30000,
              helloTimeout: 5000,
              authTimeout: 3000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      const config = service.websocket;
      expect(config.helloTimeout).toBe(5000);
      expect(config.authTimeout).toBe(3000);
    });

    it('should use custom max reconnect attempts', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.dev',
              apiKey: 'rs_key',
              reconnect: true,
              reconnectInterval: 5000,
              maxReconnectAttempts: 20,
              pingInterval: 30000,
              helloTimeout: 2000,
              authTimeout: 2000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      expect(service.websocket.maxReconnectAttempts).toBe(20);
    });

    it('should use custom ping interval', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.dev',
              apiKey: 'rs_key',
              reconnect: true,
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
              pingInterval: 60000,
              helloTimeout: 2000,
              authTimeout: 2000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      expect(service.websocket.pingInterval).toBe(60000);
    });

    it('should disable reconnect when configured', () => {
      mockConfigService.get.mockImplementation((key) => {
        if (key === 'rhinestone')
          return {
            websocket: {
              url: 'wss://test.dev',
              apiKey: 'rs_key',
              reconnect: false,
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
              pingInterval: 30000,
              helloTimeout: 2000,
              authTimeout: 2000,
              handshakeTimeout: 5000,
            },
          };
        return undefined;
      });

      expect(service.websocket.reconnect).toBe(false);
    });
  });
});
