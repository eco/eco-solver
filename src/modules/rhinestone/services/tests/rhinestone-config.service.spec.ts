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

  describe('enabled', () => {
    it('should return false when not configured', () => {
      mockConfigService.get.mockImplementation((key, defaultValue) => defaultValue);
      expect(service.enabled).toBe(false);
    });

    it('should return true when enabled in config', () => {
      mockConfigService.get.mockReturnValue(true);
      expect(service.enabled).toBe(true);
    });

    it('should return false when explicitly disabled', () => {
      mockConfigService.get.mockReturnValue(false);
      expect(service.enabled).toBe(false);
    });

    it('should use default value of false', () => {
      mockConfigService.get.mockImplementation((key, defaultValue) => defaultValue);
      expect(service.enabled).toBe(false);
    });
  });

  describe('websocket', () => {
    describe('when enabled', () => {
      it('should throw error when URL missing', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_URL') return '';
          if (key === 'RHINESTONE_API_KEY') return 'test-key';
          return defaultValue;
        });

        expect(() => service.websocket).toThrow('RHINESTONE_WS_URL is required');
      });

      it('should throw error when API key missing', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return '';
          return defaultValue;
        });

        expect(() => service.websocket).toThrow('RHINESTONE_API_KEY is required');
      });

      it('should return full config with all values', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.rhinestone.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_test_key_123';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          return defaultValue;
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
      });
    });

    describe('when disabled', () => {
      it('should not throw when URL missing', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'fulfillment.strategies.rhinestone.enabled') return false;
          if (key === 'RHINESTONE_WS_URL') return '';
          return defaultValue;
        });

        expect(() => service.websocket).not.toThrow();
      });

      it('should return empty URL when disabled', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'fulfillment.strategies.rhinestone.enabled') return false;
          return defaultValue;
        });

        const config = service.websocket;
        expect(config.url).toBe('');
        expect(config.apiKey).toBe('');
      });
    });

    describe('custom configuration', () => {
      it('should use custom reconnect interval', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_key';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_RECONNECT_INTERVAL') return 10000;
          return defaultValue;
        });

        expect(service.websocket.reconnectInterval).toBe(10000);
      });

      it('should use custom timeout values', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_key';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_HELLO_TIMEOUT') return 5000;
          if (key === 'RHINESTONE_WS_AUTH_TIMEOUT') return 3000;
          return defaultValue;
        });

        const config = service.websocket;
        expect(config.helloTimeout).toBe(5000);
        expect(config.authTimeout).toBe(3000);
      });

      it('should use custom max reconnect attempts', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_key';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_MAX_RECONNECT_ATTEMPTS') return 20;
          return defaultValue;
        });

        expect(service.websocket.maxReconnectAttempts).toBe(20);
      });

      it('should use custom ping interval', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_key';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_PING_INTERVAL') return 60000;
          return defaultValue;
        });

        expect(service.websocket.pingInterval).toBe(60000);
      });

      it('should disable reconnect when configured', () => {
        mockConfigService.get.mockImplementation((key, defaultValue) => {
          if (key === 'RHINESTONE_WS_URL') return 'wss://test.dev';
          if (key === 'RHINESTONE_API_KEY') return 'rs_key';
          if (key === 'fulfillment.strategies.rhinestone.enabled') return true;
          if (key === 'RHINESTONE_WS_RECONNECT') return false;
          return defaultValue;
        });

        expect(service.websocket.reconnect).toBe(false);
      });
    });
  });
});
