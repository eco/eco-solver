import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { Address } from 'viem';

import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { EventsService } from '@/modules/events/events.service';
import { createMockEventsService } from '@/modules/events/tests/events.service.mock';
import { SystemLoggerService } from '@/modules/logging';
import { OpenTelemetryService } from '@/modules/opentelemetry';

import { EvmTransportService } from '../../services/evm-transport.service';
import { ChainListener } from '../chain.listener';
import { EvmListenersManagerService } from '../evm-listeners-manager.service';

jest.mock('../chain.listener');

describe('EvmListenersManagerService', () => {
  let service: EvmListenersManagerService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;
  let eventsService: ReturnType<typeof createMockEventsService>;
  let logger: jest.Mocked<SystemLoggerService>;
  let otelService: jest.Mocked<OpenTelemetryService>;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockWinstonLogger: any;

  const mockNetworks = [
    {
      chainId: 1,
      contracts: {
        portal: '0xPortal1' as Address,
      },
    },
    {
      chainId: 10,
      contracts: {
        portal: '0xPortal10' as Address,
      },
    },
    {
      chainId: 137,
      contracts: {
        portal: '0xPortal137' as Address,
      },
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
      getEvmPortalAddress: jest.fn().mockImplementation((chainId: number) => {
        const network = mockNetworks.find((n) => n.chainId === chainId);
        return network?.contracts.portal;
      }),
    } as any;

    transportService = {} as any;
    eventsService = createMockEventsService();
    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
    otelService = {} as any;
    blockchainConfigService = {} as any;

    mockWinstonLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvmListenersManagerService,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: EvmTransportService, useValue: transportService },
        { provide: EventsService, useValue: eventsService },
        { provide: SystemLoggerService, useValue: logger },
        { provide: OpenTelemetryService, useValue: otelService },
        { provide: BlockchainConfigService, useValue: blockchainConfigService },
        { provide: 'winston', useValue: mockWinstonLogger },
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

      // Verify that listeners were created with correct config and services
      const calls = (ChainListener as jest.MockedClass<typeof ChainListener>).mock.calls;

      // Check first listener call
      expect(calls[0][0]).toEqual({
        chainType: 'EVM',
        chainId: 1,
        portalAddress: '0xPortal1',
      });
      expect(calls[0][1]).toBe(transportService);
      expect(calls[0][2]).toBe(eventsService);
      expect(calls[0][3]).toBeInstanceOf(SystemLoggerService);
      expect(calls[0][4]).toBe(otelService);
      expect(calls[0][5]).toBe(blockchainConfigService);
      expect(calls[0][6]).toBe(evmConfigService);

      // Check second listener call
      expect(calls[1][0]).toEqual({
        chainType: 'EVM',
        chainId: 10,
        portalAddress: '0xPortal10',
      });
      expect(calls[1][1]).toBe(transportService);
      expect(calls[1][2]).toBe(eventsService);
      expect(calls[1][3]).toBeInstanceOf(SystemLoggerService);
      expect(calls[1][4]).toBe(otelService);
      expect(calls[1][5]).toBe(blockchainConfigService);
      expect(calls[1][6]).toBe(evmConfigService);

      // Check third listener call
      expect(calls[2][0]).toEqual({
        chainType: 'EVM',
        chainId: 137,
        portalAddress: '0xPortal137',
      });
      expect(calls[2][1]).toBe(transportService);
      expect(calls[2][2]).toBe(eventsService);
      expect(calls[2][3]).toBeInstanceOf(SystemLoggerService);
      expect(calls[2][4]).toBe(otelService);
      expect(calls[2][5]).toBe(blockchainConfigService);
      expect(calls[2][6]).toBe(evmConfigService);

      // Verify all listeners were started
      expect(mockListenerInstances).toHaveLength(3);
      mockListenerInstances.forEach((listener) => {
        expect(listener.start).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle empty networks configuration', async () => {
      // Create a new service instance with empty networks
      const emptyEvmConfigService = {
        networks: [],
        getEvmPortalAddress: jest.fn(),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EvmListenersManagerService,
          { provide: EvmConfigService, useValue: emptyEvmConfigService },
          { provide: EvmTransportService, useValue: transportService },
          { provide: EventsService, useValue: eventsService },
          { provide: SystemLoggerService, useValue: logger },
          { provide: OpenTelemetryService, useValue: otelService },
          { provide: BlockchainConfigService, useValue: blockchainConfigService },
          { provide: 'winston', useValue: mockWinstonLogger },
        ],
      }).compile();

      const emptyService = module.get<EvmListenersManagerService>(EvmListenersManagerService);

      await emptyService.onModuleInit();

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

      // Should throw because Promise.all rejects if any promise rejects
      await expect(service.onModuleDestroy()).rejects.toThrow('Stop failed');

      // Other listeners should still be attempted to stop
      expect(mockListenerInstances[0].stop).toHaveBeenCalled();
      expect(mockListenerInstances[2].stop).toHaveBeenCalled();
    });

    it('should handle destroy without init', async () => {
      // Create new service instance without calling onModuleInit
      const newService = new EvmListenersManagerService(
        evmConfigService,
        transportService,
        eventsService as any,
        logger,
        otelService,
        blockchainConfigService,
        mockWinstonLogger,
      );

      await expect(newService.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should stop listeners in parallel', async () => {
      // Add delays to stop methods to test parallel execution
      mockListenerInstances.forEach((listener) => {
        listener.stop.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
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
      const testNetworks = [
        {
          chainId: 42,
          contracts: {
            portal: '0xTestPortal' as Address,
          },
        },
      ];

      Object.defineProperty(evmConfigService, 'networks', {
        get: jest.fn().mockReturnValue(testNetworks),
        configurable: true,
      });

      // Update the mock functions to return the test values
      evmConfigService.getEvmPortalAddress.mockImplementation((chainId: number) => {
        const network = testNetworks.find((n) => n.chainId === chainId);
        return network?.contracts.portal || ('0xDefaultPortal' as Address);
      });

      await service.onModuleInit();

      // Verify that listener was created with correct config and services
      const calls = (ChainListener as jest.MockedClass<typeof ChainListener>).mock.calls;
      const lastCall = calls[calls.length - 1];

      expect(lastCall[0]).toEqual({
        chainType: 'EVM',
        chainId: 42,
        portalAddress: '0xTestPortal',
      });
      expect(lastCall[1]).toBe(transportService);
      expect(lastCall[2]).toBe(eventsService);
      expect(lastCall[3]).toBeInstanceOf(SystemLoggerService);
      expect(lastCall[4]).toBe(otelService);
      expect(lastCall[5]).toBe(blockchainConfigService);
      expect(lastCall[6]).toBe(evmConfigService);
    });
  });
});
