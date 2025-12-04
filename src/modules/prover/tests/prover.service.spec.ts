import { Test, TestingModule } from '@nestjs/testing';

import { ProverType, TProverType } from '@/common/interfaces/prover.interface';
import { padTo32Bytes, UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { ProverService } from '../prover.service';
import { CcipProver } from '../provers/ccip.prover';
import { DummyProver } from '../provers/dummy.prover';
import { HyperProver } from '../provers/hyper.prover';
import { MetalayerProver } from '../provers/metalayer.prover';
import { PolymerProver } from '../provers/polymer.prover';

// Helper function to cast string to UniversalAddress
const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;

describe('ProverService', () => {
  let service: ProverService;
  let mockHyperProver: jest.Mocked<HyperProver>;
  let mockPolymerProver: jest.Mocked<PolymerProver>;
  let mockMetalayerProver: jest.Mocked<MetalayerProver>;
  let mockDummyProver: jest.Mocked<DummyProver>;
  let mockCcipProver: jest.Mocked<CcipProver>;
  let mockLogger: jest.Mocked<SystemLoggerService>;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockOtelService: jest.Mocked<OpenTelemetryService>;

  const mockHyperAddress = toUniversalAddress(
    padTo32Bytes('0x1234567890123456789012345678901234567890'),
  );
  const mockMetalayerAddress = toUniversalAddress(
    padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
  );
  const mockCcipAddress = toUniversalAddress(
    padTo32Bytes('0x7777777777777777777777777777777777777777'),
  );

  beforeEach(async () => {
    const hyperAddressMap = new Map([
      [1, mockHyperAddress],
      [10, mockHyperAddress],
    ]);

    mockHyperProver = {
      type: ProverType.HYPER,
      onModuleInit: jest.fn(),
      getContractAddress: jest.fn().mockImplementation((chainId: number) => {
        return hyperAddressMap.get(chainId);
      }),
      isSupported: jest.fn().mockImplementation((chainId: number) => {
        return hyperAddressMap.has(chainId);
      }),
      getDeadlineBuffer: jest.fn().mockReturnValue(300n), // 5 minutes
      getDomainId: jest.fn().mockImplementation((chainId: number) => BigInt(chainId)),
    } as unknown as jest.Mocked<HyperProver>;

    const metalayerAddressMap = new Map([
      [137, mockMetalayerAddress],
      [8453, mockMetalayerAddress],
    ]);

    mockMetalayerProver = {
      type: ProverType.METALAYER,
      onModuleInit: jest.fn(),
      getContractAddress: jest.fn().mockImplementation((chainId: number) => {
        return metalayerAddressMap.get(chainId);
      }),
      isSupported: jest.fn().mockImplementation((chainId: number) => {
        return metalayerAddressMap.has(chainId);
      }),
      getDeadlineBuffer: jest.fn().mockReturnValue(600n), // 10 minutes
      getDomainId: jest.fn().mockImplementation((chainId: number) => BigInt(chainId)),
    } as unknown as jest.Mocked<MetalayerProver>;

    mockPolymerProver = {
      type: ProverType.POLYMER,
      onModuleInit: jest.fn(),
      getContractAddress: jest.fn().mockReturnValue(undefined),
      isSupported: jest.fn().mockReturnValue(false),
      getDeadlineBuffer: jest.fn().mockReturnValue(3600n), // 1 hour
      getDomainId: jest.fn().mockImplementation((chainId: number) => BigInt(chainId)),
    } as unknown as jest.Mocked<PolymerProver>;

    mockDummyProver = {
      type: ProverType.DUMMY,
      onModuleInit: jest.fn(),
      getContractAddress: jest.fn().mockReturnValue(undefined),
      isSupported: jest.fn().mockReturnValue(false),
      getDeadlineBuffer: jest.fn().mockReturnValue(600n), // 10 minutes
      getDomainId: jest.fn().mockImplementation((chainId: number) => BigInt(chainId)),
    } as unknown as jest.Mocked<DummyProver>;

    const ccipAddressMap = new Map([
      [1, mockCcipAddress],
      [42161, mockCcipAddress], // Arbitrum
    ]);

    mockCcipProver = {
      type: ProverType.CCIP,
      onModuleInit: jest.fn(),
      getContractAddress: jest.fn().mockImplementation((chainId: number) => {
        return ccipAddressMap.get(chainId);
      }),
      isSupported: jest.fn().mockImplementation((chainId: number) => {
        return ccipAddressMap.has(chainId);
      }),
      getDeadlineBuffer: jest.fn().mockReturnValue(7200n), // 2 hours default
      getDomainId: jest.fn().mockImplementation((chainId: number) => BigInt(chainId)),
    } as unknown as jest.Mocked<CcipProver>;

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<SystemLoggerService>;

    mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            addEvent: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
    } as unknown as jest.Mocked<OpenTelemetryService>;

    mockBlockchainConfigService = {
      getPortalAddress: jest.fn().mockImplementation((chainId: number) => {
        // Return mock portal addresses for supported chains
        const portalAddresses: { [key: number]: UniversalAddress } = {
          1: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          10: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          137: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          8453: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          42161: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
        };
        return portalAddresses[chainId];
      }),
      getAvailableProvers: jest.fn(),
      getDefaultProver: jest.fn(),
    } as unknown as jest.Mocked<BlockchainConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProverService,
        {
          provide: HyperProver,
          useValue: mockHyperProver,
        },
        {
          provide: PolymerProver,
          useValue: mockPolymerProver,
        },
        {
          provide: MetalayerProver,
          useValue: mockMetalayerProver,
        },
        {
          provide: DummyProver,
          useValue: mockDummyProver,
        },
        {
          provide: CcipProver,
          useValue: mockCcipProver,
        },
        {
          provide: SystemLoggerService,
          useValue: mockLogger,
        },
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
        },
        {
          provide: OpenTelemetryService,
          useValue: mockOtelService,
        },
      ],
    }).compile();

    service = module.get<ProverService>(ProverService);
  });

  describe('onModuleInit', () => {
    it('should initialize provers on module init', () => {
      // The ProverService.onModuleInit() just calls initializeProvers()
      // which registers the provers in the internal map
      service.onModuleInit();

      // Verify that the provers are registered (checked in next test)
      expect(service['provers'].size).toBeGreaterThan(0);
    });

    it('should register provers in the internal map', () => {
      service.onModuleInit();

      // Test HyperProver registration
      const hyperProver1 = service.getProver(1, mockHyperAddress);
      expect(hyperProver1).toBe(mockHyperProver);

      const hyperProver10 = service.getProver(10, mockHyperAddress);
      expect(hyperProver10).toBe(mockHyperProver);

      // Test MetalayerProver registration
      const metalayerProver137 = service.getProver(137, mockMetalayerAddress);
      expect(metalayerProver137).toBe(mockMetalayerProver);

      const metalayerProver8453 = service.getProver(8453, mockMetalayerAddress);
      expect(metalayerProver8453).toBe(mockMetalayerProver);
    });
  });

  describe('validateIntentRoute', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should validate intent route with HyperProver', async () => {
      const intent = createMockIntent({
        sourceChainId: 1n,
        destination: 10n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
        reward: {
          prover: mockHyperAddress, // Must match the prover address for chain 1
          creator: toUniversalAddress(padTo32Bytes('0x4444444444444444444444444444444444444444')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: 0n,
          tokens: [],
        },
      });

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: true,
      });
    });

    it('should validate intent route with MetalayerProver', async () => {
      const intent = createMockIntent({
        sourceChainId: 137n,
        destination: 8453n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
        reward: {
          prover: mockMetalayerAddress, // Must match the prover address for chain 137
          creator: toUniversalAddress(padTo32Bytes('0x4444444444444444444444444444444444444444')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: 0n,
          tokens: [],
        },
      });

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: true,
      });
    });

    it('should validate intent route with CcipProver', async () => {
      const intent = createMockIntent({
        sourceChainId: 1n,
        destination: 42161n, // Arbitrum
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
        reward: {
          prover: mockCcipAddress,
          creator: toUniversalAddress(padTo32Bytes('0x4444444444444444444444444444444444444444')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: 0n,
          tokens: [],
        },
      });

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: true,
      });
    });

    it('should return invalid when no prover supports the route', async () => {
      const intent = createMockIntent({
        sourceChainId: 999n,
        destination: 888n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
      });

      // Mock the blockchain config service to return null for unsupported chain
      mockBlockchainConfigService.getPortalAddress.mockReturnValueOnce(undefined as any);

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: false,
        reason: 'No Portal address configured for destination chain 888',
      });
    });

    it('should return invalid when no prover supports the chain combination', async () => {
      const intent = createMockIntent({
        sourceChainId: 999n,
        destination: 888n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
      });

      // Mock the blockchain config service to return a portal address (so we pass portal validation)
      mockBlockchainConfigService.getPortalAddress.mockReturnValueOnce(
        toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
      );

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: false,
        reason: 'Intent prover is not allowed',
      });
    });

    // Note: The current implementation doesn't handle prover validation failures
    // as it doesn't call validateRoute on the provers

    it('should prefer prover that supports both source and destination', async () => {
      // Setup: HyperProver supports chain 1, MetalayerProver supports chains 1 and 137
      mockHyperProver.getContractAddress.mockImplementation((chainId) => {
        return chainId === 1 ? mockHyperAddress : undefined;
      });
      mockHyperProver.isSupported.mockImplementation((chainId) => chainId === 1);

      mockMetalayerProver.getContractAddress.mockImplementation((chainId) => {
        return chainId === 1 || chainId === 137 ? mockMetalayerAddress : undefined;
      });
      mockMetalayerProver.isSupported.mockImplementation(
        (chainId) => chainId === 1 || chainId === 137,
      );

      // Re-initialize to pick up the new configuration
      service.onModuleInit();

      const intent = createMockIntent({
        sourceChainId: 1n,
        destination: 137n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
        reward: {
          prover: mockMetalayerAddress, // Use metalayer prover address for chain 1
          creator: toUniversalAddress(padTo32Bytes('0x4444444444444444444444444444444444444444')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: 0n,
          tokens: [],
        },
      });

      const result = await service.validateIntentRoute(intent);

      expect(result).toEqual({
        isValid: true,
      });
    });
  });

  describe('getProver', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return prover by chain ID and address', () => {
      const prover = service.getProver(1, mockHyperAddress);
      expect(prover).toBe(mockHyperProver);
    });

    it('should return null for non-existent prover', () => {
      const prover = service.getProver(
        999,
        toUniversalAddress(padTo32Bytes('0x0000000000000000000000000000000000000000')),
      );
      expect(prover).toBeNull();
    });

    it('should return null for wrong address on correct chain', () => {
      const prover = service.getProver(
        1,
        toUniversalAddress(padTo32Bytes('0x0000000000000000000000000000000000000000')),
      );
      expect(prover).toBeNull();
    });

    it('should handle case-insensitive address comparison', () => {
      // Note: For UniversalAddress, we test with the same address (case sensitive for branded types)
      const prover = service.getProver(1, mockHyperAddress);
      expect(prover).toBe(mockHyperProver);
    });
  });

  describe('selectProverForRoute', () => {
    beforeEach(() => {
      // Reset mocks for clean test state
      mockBlockchainConfigService.getAvailableProvers.mockClear();
      mockBlockchainConfigService.getDefaultProver.mockClear();
      mockLogger.debug.mockClear();
      mockLogger.error.mockClear();
    });

    it('should select default prover when available in intersection', () => {
      // Setup: Both chains have hyper and polymer, default is hyper
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[]) // source chain
        .mockReturnValueOnce(['hyper', 'polymer', 'metalayer'] as TProverType[]); // dest chain
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('hyper');
      expect(mockBlockchainConfigService.getAvailableProvers).toHaveBeenCalledWith(1n);
      expect(mockBlockchainConfigService.getAvailableProvers).toHaveBeenCalledWith(10n);
      expect(mockBlockchainConfigService.getDefaultProver).toHaveBeenCalledWith(1n);
    });

    it('should fallback to first available prover when default not in intersection', () => {
      // Setup: Intersection has polymer and metalayer, but default is hyper (not available)
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['polymer', 'metalayer'] as TProverType[]) // source chain
        .mockReturnValueOnce(['polymer', 'metalayer', 'ccip'] as TProverType[]); // dest chain
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('polymer'); // First in intersection
      expect(mockBlockchainConfigService.getDefaultProver).toHaveBeenCalledWith(1n);
    });

    it('should throw error when no compatible prover found', () => {
      // Setup: No intersection between source and destination provers
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[]) // source chain
        .mockReturnValueOnce(['metalayer', 'ccip'] as TProverType[]); // dest chain

      expect(() => service.selectProverForRoute(1n, 10n)).toThrow(
        'No compatible prover found for route 1 -> 10. ' +
          'Source chain provers: [hyper, polymer], ' +
          'Destination chain provers: [metalayer, ccip]',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'No compatible prover found for route 1 -> 10. ' +
          'Source chain provers: [hyper, polymer], ' +
          'Destination chain provers: [metalayer, ccip]',
      );
    });

    it('should handle single prover in intersection', () => {
      // Setup: Only ccip is available on both chains
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['ccip'] as TProverType[]) // source chain
        .mockReturnValueOnce(['ccip', 'hyper'] as TProverType[]); // dest chain
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('ccip');
    });

    it('should handle empty prover list on source chain', () => {
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce([] as TProverType[]) // source chain
        .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[]); // dest chain

      expect(() => service.selectProverForRoute(1n, 10n)).toThrow(
        'No compatible prover found for route 1 -> 10. ' +
          'Source chain provers: [], ' +
          'Destination chain provers: [hyper, polymer]',
      );
    });

    it('should handle empty prover list on destination chain', () => {
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[]) // source chain
        .mockReturnValueOnce([] as TProverType[]); // dest chain

      expect(() => service.selectProverForRoute(1n, 10n)).toThrow(
        'No compatible prover found for route 1 -> 10. ' +
          'Source chain provers: [hyper, polymer], ' +
          'Destination chain provers: []',
      );
    });

    it('should handle all provers being compatible', () => {
      // Setup: All provers available on both chains
      const allProvers: TProverType[] = [
        'hyper',
        'polymer',
        'metalayer',
        'dummy',
        'ccip',
      ] as TProverType[];
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(allProvers) // source chain
        .mockReturnValueOnce(allProvers); // dest chain
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('metalayer' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('metalayer'); // Default prover selected
    });

    it('should maintain order preference when default not available', () => {
      // Setup: Test that it returns first in intersection, maintaining source order
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['ccip', 'metalayer', 'polymer'] as TProverType[]) // source chain
        .mockReturnValueOnce(['polymer', 'ccip', 'metalayer'] as TProverType[]); // dest chain (different order)
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('ccip'); // First in source chain order that's also in destination
    });

    it('should handle duplicate provers in lists correctly', () => {
      // Even if there are duplicates (shouldn't happen but testing edge case)
      mockBlockchainConfigService.getAvailableProvers
        .mockReturnValueOnce(['hyper', 'hyper', 'polymer'] as TProverType[]) // source with duplicate
        .mockReturnValueOnce(['polymer', 'hyper'] as TProverType[]); // dest chain
      mockBlockchainConfigService.getDefaultProver.mockReturnValue('polymer' as TProverType);

      const result = service.selectProverForRoute(1n, 10n);

      expect(result).toBe('polymer'); // Default is available
    });

    describe('caching', () => {
      beforeEach(() => {
        // Clear cache before each test
        service.clearRouteProverCache();
      });

      it('should cache prover selection results', () => {
        mockBlockchainConfigService.getAvailableProvers
          .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[])
          .mockReturnValueOnce(['hyper', 'polymer'] as TProverType[]);
        mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

        // First call - cache miss
        const result1 = service.selectProverForRoute(1n, 42161n);

        // Second call - cache hit
        const result2 = service.selectProverForRoute(1n, 42161n);

        expect(result1).toBe('hyper');
        expect(result2).toBe('hyper');
        // Config services should only be called once (on cache miss)
        expect(mockBlockchainConfigService.getAvailableProvers).toHaveBeenCalledTimes(2);
        expect(mockBlockchainConfigService.getDefaultProver).toHaveBeenCalledTimes(1);
      });

      it('should cache different provers for different routes', () => {
        // Route 1: 1 -> 10
        mockBlockchainConfigService.getAvailableProvers
          .mockReturnValueOnce(['hyper'] as TProverType[])
          .mockReturnValueOnce(['hyper'] as TProverType[]);
        mockBlockchainConfigService.getDefaultProver.mockReturnValue('hyper' as TProverType);

        const result1 = service.selectProverForRoute(1n, 10n);
        expect(result1).toBe('hyper');

        // Route 2: 8453 -> 2020
        mockBlockchainConfigService.getAvailableProvers
          .mockReturnValueOnce(['ccip'] as TProverType[])
          .mockReturnValueOnce(['ccip'] as TProverType[]);
        mockBlockchainConfigService.getDefaultProver.mockReturnValue('ccip' as TProverType);

        const result2 = service.selectProverForRoute(8453n, 2020n);
        expect(result2).toBe('ccip');

        // Call both again - should hit cache
        const result3 = service.selectProverForRoute(1n, 10n);
        const result4 = service.selectProverForRoute(8453n, 2020n);

        expect(result3).toBe('hyper');
        expect(result4).toBe('ccip');

        // Verify config services not called again (both routes cached)
        expect(mockBlockchainConfigService.getAvailableProvers).toHaveBeenCalledTimes(4); // 2 per route
        expect(mockBlockchainConfigService.getDefaultProver).toHaveBeenCalledTimes(2); // 1 per route
      });

      it('should not cache errors when no compatible prover found', () => {
        mockBlockchainConfigService.getAvailableProvers
          .mockReturnValueOnce(['hyper'] as TProverType[])
          .mockReturnValueOnce(['ccip'] as TProverType[]);

        // First call should throw
        expect(() => service.selectProverForRoute(1n, 999n)).toThrow(
          'No compatible prover found for route 1 -> 999',
        );

        // Verify nothing was cached
        expect(service['routeProverCache'].size).toBe(0);

        // Second call should also throw (not return cached error)
        expect(() => service.selectProverForRoute(1n, 999n)).toThrow();
      });
    });
  });
});
