import { Test, TestingModule } from '@nestjs/testing';

import { IntentDiscovery } from '@/common/enums/intent-discovery.enum';
import { IntentDiscoveryService } from '@/modules/intents/services/intent-discovery.service';
import { IntentsService } from '@/modules/intents/intents.service';
import { RedisService } from '@/modules/redis/redis.service';

describe('IntentDiscoveryService', () => {
  let service: IntentDiscoveryService;
  let intentsService: jest.Mocked<IntentsService>;
  let redisService: jest.Mocked<any>;

  beforeEach(async () => {
    const mockIntentsService = {
      findById: jest.fn(),
    };

    const mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        keys: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentDiscoveryService,
        { provide: IntentsService, useValue: mockIntentsService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<IntentDiscoveryService>(IntentDiscoveryService);
    intentsService = module.get(IntentsService);
    redisService = module.get(RedisService);
  });

  describe('getDiscovery', () => {
    it('should return cached value on cache hit', async () => {
      const mockClient = redisService.getClient();
      mockClient.get.mockResolvedValue('rhinestone-websocket');

      const result = await service.getDiscovery('0x123');

      expect(result).toBe('rhinestone-websocket');
      expect(mockClient.get).toHaveBeenCalledWith('intent:discovery:0x123');
      expect(intentsService.findById).not.toHaveBeenCalled();
    });

    it('should query DB and cache on cache miss', async () => {
      const mockClient = redisService.getClient();
      mockClient.get.mockResolvedValue(null); // Cache miss
      intentsService.findById.mockResolvedValue({
        intentHash: '0x123',
        discovery: IntentDiscovery.RHINESTONE_WEBSOCKET,
      } as any);

      const result = await service.getDiscovery('0x123');

      expect(result).toBe('rhinestone-websocket');
      expect(mockClient.get).toHaveBeenCalled();
      expect(intentsService.findById).toHaveBeenCalledWith('0x123');
      expect(mockClient.set).toHaveBeenCalledWith(
        'intent:discovery:0x123',
        'rhinestone-websocket',
        'EX',
        3600,
      );
    });

    it('should default to blockchain-event if intent not found', async () => {
      const mockClient = redisService.getClient();
      mockClient.get.mockResolvedValue(null);
      intentsService.findById.mockResolvedValue(null); // Intent doesn't exist

      const result = await service.getDiscovery('0x123');

      expect(result).toBe('blockchain-event');
      expect(mockClient.set).toHaveBeenCalledWith(
        'intent:discovery:0x123',
        'blockchain-event',
        'EX',
        3600,
      );
    });

    it('should fall back to DB on Redis error', async () => {
      const mockClient = redisService.getClient();
      mockClient.get.mockRejectedValue(new Error('Redis connection failed'));
      intentsService.findById.mockResolvedValue({
        intentHash: '0x123',
        discovery: IntentDiscovery.BLOCKCHAIN_EVENT,
      } as any);

      const result = await service.getDiscovery('0x123');

      expect(result).toBe('blockchain-event');
      expect(intentsService.findById).toHaveBeenCalled();
    });

    it('should handle undefined discovery field (backward compat)', async () => {
      const mockClient = redisService.getClient();
      mockClient.get.mockResolvedValue(null);
      intentsService.findById.mockResolvedValue({
        intentHash: '0x123',
        // No discovery field
      } as any);

      const result = await service.getDiscovery('0x123');

      expect(result).toBe('blockchain-event');
    });
  });

  describe('setDiscovery', () => {
    it('should set value in cache', async () => {
      const mockClient = redisService.getClient();

      await service.setDiscovery('0x123', 'rhinestone-websocket');

      expect(mockClient.set).toHaveBeenCalledWith(
        'intent:discovery:0x123',
        'rhinestone-websocket',
        'EX',
        3600,
      );
    });

    it('should not throw on Redis error', async () => {
      const mockClient = redisService.getClient();
      mockClient.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.setDiscovery('0x123', 'rhinestone-websocket')).resolves.not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should delete all discovery cache keys', async () => {
      const mockClient = redisService.getClient();
      mockClient.keys.mockResolvedValue(['intent:discovery:0x111', 'intent:discovery:0x222']);

      await service.clearCache();

      expect(mockClient.keys).toHaveBeenCalledWith('intent:discovery:*');
      expect(mockClient.del).toHaveBeenCalledWith('intent:discovery:0x111', 'intent:discovery:0x222');
    });

    it('should handle empty cache', async () => {
      const mockClient = redisService.getClient();
      mockClient.keys.mockResolvedValue([]);

      await service.clearCache();

      expect(mockClient.del).not.toHaveBeenCalled();
    });
  });
});
