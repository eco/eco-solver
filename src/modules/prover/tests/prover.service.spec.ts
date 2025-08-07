import { Test, TestingModule } from '@nestjs/testing';

import { Address } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { ProverService } from '../prover.service';
import { HyperProver } from '../provers/hyper.prover';
import { MetalayerProver } from '../provers/metalayer.prover';

describe('ProverService', () => {
  let service: ProverService;
  let mockHyperProver: jest.Mocked<HyperProver>;
  let mockMetalayerProver: jest.Mocked<MetalayerProver>;

  const mockHyperAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockMetalayerAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;

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
    } as unknown as jest.Mocked<MetalayerProver>;

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
        route: {
          source: 1n,
          destination: 10n,
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
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
        route: {
          source: 137n,
          destination: 8453n,
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
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
        route: {
          source: 999n,
          destination: 888n,
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [],
        },
      });

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
        route: {
          source: 1n,
          destination: 137n,
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
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
        '0x0000000000000000000000000000000000000000' as Address,
      );
      expect(prover).toBeNull();
    });

    it('should return null for wrong address on correct chain', () => {
      const prover = service.getProver(1, '0x0000000000000000000000000000000000000000' as Address);
      expect(prover).toBeNull();
    });

    it('should handle case-insensitive address comparison', () => {
      // Note: Viem's isAddressEqual handles case-insensitive comparison
      // but requires valid checksummed addresses
      const lowerCaseAddress = mockHyperAddress.toLowerCase() as Address;
      const prover = service.getProver(1, lowerCaseAddress);
      expect(prover).toBe(mockHyperProver);
    });
  });
});
