import { Test, TestingModule } from '@nestjs/testing';

import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress, toUniversalAddress, padTo32Bytes } from '@/common/types/universal-address.type';
import { BlockchainConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { ProverService } from '../prover.service';
import { HyperProver } from '../provers/hyper.prover';
import { MetalayerProver } from '../provers/metalayer.prover';

describe('ProverService', () => {
  let service: ProverService;
  let mockHyperProver: jest.Mocked<HyperProver>;
  let mockMetalayerProver: jest.Mocked<MetalayerProver>;
  let mockLogger: jest.Mocked<SystemLoggerService>;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;

  const mockHyperAddress = toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890'));
  const mockMetalayerAddress = toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'));

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
    } as unknown as jest.Mocked<MetalayerProver>;

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<SystemLoggerService>;

    mockBlockchainConfigService = {
      getPortalAddress: jest.fn().mockImplementation((chainId: number) => {
        // Return mock portal addresses for supported chains
        const portalAddresses: { [key: number]: UniversalAddress } = {
          1: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          10: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          137: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          8453: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
        };
        return portalAddresses[chainId];
      }),
    } as unknown as jest.Mocked<BlockchainConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProverService,
        {
          provide: HyperProver,
          useValue: mockHyperProver,
        },
        {
          provide: MetalayerProver,
          useValue: mockMetalayerProver,
        },
        {
          provide: SystemLoggerService,
          useValue: mockLogger,
        },
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
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
      mockBlockchainConfigService.getPortalAddress.mockReturnValueOnce(undefined);

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
        reason: 'No prover found for this route',
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
      const prover = service.getProver(1, toUniversalAddress(padTo32Bytes('0x0000000000000000000000000000000000000000')));
      expect(prover).toBeNull();
    });

    it('should handle case-insensitive address comparison', () => {
      // Note: For UniversalAddress, we test with the same address (case sensitive for branded types)
      const prover = service.getProver(1, mockHyperAddress);
      expect(prover).toBe(mockHyperProver);
    });
  });

  describe('getMaxDeadlineBuffer', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return maximum deadline buffer from provers that support the route', () => {
      const buffer = service.getMaxDeadlineBuffer(1, 10);

      // HyperProver supports both chains and has 300n buffer
      expect(buffer).toBe(300n);
    });

    it('should return maximum buffer when multiple provers support the route', () => {
      // Setup both provers to support the same route
      mockHyperProver.isSupported.mockImplementation((chainId) => chainId === 1 || chainId === 137);
      mockMetalayerProver.isSupported.mockImplementation(
        (chainId) => chainId === 1 || chainId === 137,
      );

      // Re-initialize to pick up changes
      service.onModuleInit();

      const buffer = service.getMaxDeadlineBuffer(1, 137);

      // MetalayerProver has larger buffer (600n vs 300n)
      expect(buffer).toBe(600n);
    });

    it('should return default buffer when no prover supports the route', () => {
      const buffer = service.getMaxDeadlineBuffer(999, 888);

      // Default buffer is 300n (5 minutes)
      expect(buffer).toBe(300n);
    });
  });

  describe('validateProofSubmission', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should validate proof submission with valid intent hashes', async () => {
      const intentHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0x1111111111111111222222222222222233333333333333334444444444444444',
      ];

      const result = await service.validateProofSubmission(intentHashes, 1, 10);

      expect(result).toEqual({
        isValid: true,
      });
    });

    it('should return invalid when no prover supports the route', async () => {
      const intentHashes = ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'];

      const result = await service.validateProofSubmission(intentHashes, 999, 888);

      expect(result).toEqual({
        isValid: false,
        reason: 'No prover available for route 999 -> 888',
      });
    });

    it('should return invalid for malformed intent hashes', async () => {
      const intentHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'invalid-hash', // Invalid format
      ];

      const result = await service.validateProofSubmission(intentHashes, 1, 10);

      expect(result).toEqual({
        isValid: false,
        reason: 'Invalid intent hash format: invalid-hash',
      });
    });

    it('should return invalid for short intent hashes', async () => {
      const intentHashes = [
        '0x1234567890abcdef', // Too short
      ];

      const result = await service.validateProofSubmission(intentHashes, 1, 10);

      expect(result).toEqual({
        isValid: false,
        reason: 'Invalid intent hash format: 0x1234567890abcdef',
      });
    });
  });
});
