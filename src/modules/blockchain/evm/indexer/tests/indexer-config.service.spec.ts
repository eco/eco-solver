import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { IndexerConfigService } from '../indexer-config.service';

describe('IndexerConfigService', () => {
  let service: IndexerConfigService;
  let configService: jest.Mocked<ConfigService>;

  const mockIndexerConfig = {
    url: 'https://indexer.eco.com/',
    intervals: {
      intentPublished: 2000,
      intentFunded: 5000,
      intentFulfilled: 5000,
      intentWithdrawn: 60000,
    },
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [IndexerConfigService, { provide: ConfigService, useValue: configService }],
    }).compile();

    service = module.get<IndexerConfigService>(IndexerConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('config', () => {
    it('should return indexer config when configured', () => {
      configService.get.mockReturnValue(mockIndexerConfig);

      const result = service.config;

      expect(result).toEqual(mockIndexerConfig);
      expect(configService.get).toHaveBeenCalledWith('evm.indexer');
    });

    it('should return undefined when not configured', () => {
      configService.get.mockReturnValue(undefined);

      const result = service.config;

      expect(result).toBeUndefined();
    });
  });

  describe('url', () => {
    it('should return URL when configured', () => {
      configService.get.mockReturnValue(mockIndexerConfig);

      const result = service.url;

      expect(result).toBe('https://indexer.eco.com/');
    });

    it('should throw error when not configured', () => {
      configService.get.mockReturnValue(undefined);

      expect(() => service.url).toThrow('Indexer configuration is not defined');
    });
  });

  describe('intervals', () => {
    it('should return intervals from config', () => {
      configService.get.mockReturnValue(mockIndexerConfig);

      const result = service.intervals;

      expect(result).toEqual({
        intentPublished: 2000,
        intentFunded: 5000,
        intentFulfilled: 5000,
        intentWithdrawn: 60000,
      });
    });

    it('should return default intervals when config not available', () => {
      configService.get.mockReturnValue(undefined);

      const result = service.intervals;

      expect(result).toEqual({
        intentPublished: 2000,
        intentFunded: 5000,
        intentFulfilled: 5000,
        intentWithdrawn: 60000,
      });
    });

    it('should return default intervals when intervals not in config', () => {
      configService.get.mockReturnValue({ url: 'https://test.com' });

      const result = service.intervals;

      expect(result).toEqual({
        intentPublished: 2000,
        intentFunded: 5000,
        intentFulfilled: 5000,
        intentWithdrawn: 60000,
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when config exists', () => {
      configService.get.mockReturnValue(mockIndexerConfig);

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when config is undefined', () => {
      configService.get.mockReturnValue(undefined);

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when config is null', () => {
      configService.get.mockReturnValue(null);

      expect(service.isConfigured()).toBe(false);
    });
  });
});
