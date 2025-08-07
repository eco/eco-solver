import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Address } from 'viem';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../services/evm-transport.service';
import { ChainListener } from '../chain.listener';
import { EvmListenersManagerService } from '../evm-listeners-manager.service';

jest.mock('../chain.listener');

describe('EvmListenersManagerService', () => {
  let service: EvmListenersManagerService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockNetworks = [
    {
      chainId: 1,
      inboxAddress: '0xInbox1' as Address,
      intentSourceAddress: '0xIntentSource1' as Address,
    },
    {
      chainId: 10,
      inboxAddress: '0xInbox10' as Address,
      intentSourceAddress: '0xIntentSource10' as Address,
    },
    {
      chainId: 137,
      inboxAddress: '0xInbox137' as Address,
      intentSourceAddress: '0xIntentSource137' as Address,
    },
  ];

  const mockListenerInstances: jest.Mocked<ChainListener>[] = [];

  beforeEach(async () => {
    // Clear mock listener instances
    mockListenerInstances.length = 0;

    // Mock ChainListener constructor
    (ChainListener as jest.MockedClass<typeof ChainListener>).mockImplementation(() => {
      const mockListener = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
      } as any;
      mockListenerInstances.push(mockListener);
      return mockListener;
    });

    evmConfigService = {
      networks: mockNetworks,
    } as any;

    transportService = {} as any;
    eventEmitter = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvmListenersManagerService,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: EvmTransportService, useValue: transportService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<EvmListenersManagerService>(EvmListenersManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should create and start listeners for all configured networks', async () => {
      await service.onModuleInit();

      // Should create 3 listeners
      expect(ChainListener).toHaveBeenCalledTimes(3);

      // Verify each listener was created with correct config
      expect(ChainListener).toHaveBeenCalledWith(
        {
          chainType: 'EVM',
          chainId: 1,
          inboxAddress: '0xInbox1',
          intentSourceAddress: '0xIntentSource1',
        },
        transportService,
        eventEmitter
      );

      expect(ChainListener).toHaveBeenCalledWith(
        {
          chainType: 'EVM',
          chainId: 10,
          inboxAddress: '0xInbox10',
          intentSourceAddress: '0xIntentSource10',
        },
        transportService,
        eventEmitter
      );

      expect(ChainListener).toHaveBeenCalledWith(
        {
          chainType: 'EVM',
          chainId: 137,
          inboxAddress: '0xInbox137',
          intentSourceAddress: '0xIntentSource137',
        },
        transportService,
        eventEmitter
      );

      // Verify all listeners were started
      expect(mockListenerInstances).toHaveLength(3);
      mockListenerInstances.forEach((listener) => {
        expect(listener.start).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle empty networks configuration', async () => {
      evmConfigService.networks = [];

      await service.onModuleInit();

      expect(ChainListener).not.toHaveBeenCalled();
    });

    it('should handle listener start errors', async () => {
      const error = new Error('Failed to start listener');
      (ChainListener as jest.MockedClass<typeof ChainListener>).mockImplementationOnce(() => {
        return {
          start: jest.fn().mockRejectedValue(error),
          stop: jest.fn(),
        } as any;
      });

      await expect(service.onModuleInit()).rejects.toThrow(error);
    });

    it('should store listeners by chain ID', async () => {
      await service.onModuleInit();

      // Access private property for testing
      const listeners = (service as any).listeners as Map<number, ChainListener>;
      
      expect(listeners.size).toBe(3);
      expect(listeners.has(1)).toBe(true);
      expect(listeners.has(10)).toBe(true);
      expect(listeners.has(137)).toBe(true);
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should stop all listeners', async () => {
      await service.onModuleDestroy();

      // Verify all listeners were stopped
      mockListenerInstances.forEach((listener) => {
        expect(listener.stop).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear listeners map', async () => {
      await service.onModuleDestroy();

      // Access private property for testing
      const listeners = (service as any).listeners as Map<number, ChainListener>;
      expect(listeners.size).toBe(0);
    });

    it('should handle stop errors gracefully', async () => {
      // Make one listener fail to stop
      mockListenerInstances[1].stop.mockRejectedValue(new Error('Stop failed'));

      // Should not throw - Promise.all will handle the rejection
      await expect(service.onModuleDestroy()).resolves.not.toThrow();

      // Other listeners should still be stopped
      expect(mockListenerInstances[0].stop).toHaveBeenCalled();
      expect(mockListenerInstances[2].stop).toHaveBeenCalled();
    });

    it('should handle destroy without init', async () => {
      // Create new service instance without calling onModuleInit
      const newService = new EvmListenersManagerService(
        evmConfigService,
        transportService,
        eventEmitter
      );

      await expect(newService.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should stop listeners in parallel', async () => {
      // Add delays to stop methods to test parallel execution
      mockListenerInstances.forEach((listener, index) => {
        listener.stop.mockImplementation(
          () => new Promise(resolve => setTimeout(resolve, 100))
        );
      });

      const start = Date.now();
      await service.onModuleDestroy();
      const duration = Date.now() - start;

      // Should complete in ~100ms, not 300ms (sequential)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('network configuration', () => {
    it('should handle networks with different configurations', async () => {
      Object.defineProperty(evmConfigService, 'networks', {
        get: jest.fn().mockReturnValue([
          {
            chainId: 42,
            inboxAddress: '0xTestInbox' as Address,
            intentSourceAddress: '0xTestIntentSource' as Address,
          },
        ]),
        configurable: true,
      });

      await service.onModuleInit();

      expect(ChainListener).toHaveBeenCalledWith(
        {
          chainType: 'EVM',
          chainId: 42,
          inboxAddress: '0xTestInbox',
          intentSourceAddress: '0xTestIntentSource',
        },
        transportService,
        eventEmitter
      );
    });
  });
});