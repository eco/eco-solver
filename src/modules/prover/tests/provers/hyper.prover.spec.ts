import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { encodeAbiParameters, Hex, pad } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import {
  padTo32Bytes,
  toUniversalAddress,
  UniversalAddress,
} from '@/common/types/universal-address.type';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { HyperProver } from '../../provers/hyper.prover';

describe('HyperProver', () => {
  let prover: HyperProver;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = toUniversalAddress(
    padTo32Bytes('0x1234567890123456789012345678901234567890'),
  );
  const testAddress2 = toUniversalAddress(
    padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'),
  );
  const mockFee = 1000000n;
  const mockClaimant = toUniversalAddress(
    padTo32Bytes('0x9999999999999999999999999999999999999999'),
  );

  beforeEach(async () => {
    mockBlockchainReaderService = {
      fetchProverFee: jest.fn().mockResolvedValue(mockFee),
    } as unknown as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    mockBlockchainConfigService = {
      getProverAddress: jest
        .fn()
        .mockImplementation((chainId: number | string | bigint, proverType: ProverType) => {
          const numericChainId = Number(chainId);
          if (numericChainId === 1 && proverType === 'hyper') {
            return testAddress1;
          }
          if (numericChainId === 10 && proverType === 'hyper') {
            return testAddress2;
          }
          return undefined;
        }),
    } as unknown as jest.Mocked<BlockchainConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperProver,
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
      ],
    }).compile();

    prover = module.get<HyperProver>(HyperProver);
  });

  describe('constructor', () => {
    it('should initialize with correct type and contract addresses', () => {
      expect(prover.type).toBe(ProverType.HYPER);
      expect(prover.getContractAddress(1)).toBe(testAddress1);
      expect(prover.getContractAddress(10)).toBe(testAddress2);
    });

    it('should handle empty chain configs', () => {
      const emptyConfigService = {
        getProverAddress: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<BlockchainConfigService>;
      const emptyProver = new HyperProver(emptyConfigService, mockModuleRef);

      expect(emptyProver.getContractAddress(1)).toBeUndefined();
      expect(emptyProver.isSupported(1)).toBe(false);
    });
  });

  describe('generateProof', () => {
    it('should encode proof data correctly for intent', async () => {
      const proverAddress = toUniversalAddress(
        padTo32Bytes('0x3333333333333333333333333333333333333333'),
      );
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: toUniversalAddress(padTo32Bytes('0x4444444444444444444444444444444444444444')),
          deadline: 1234567890n,
          nativeAmount: 200n,
          tokens: [],
        },
      });

      const proofData = await prover.generateProof(intent);

      // Verify the structure matches the actual implementation
      const expectedData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
          },
        ],
        [[pad(proverAddress as `0x${string}`), '0x', '0x0000000000000000000000000000000000000000']],
      );

      expect(proofData).toBe(expectedData);
    });

    it('should handle different prover addresses', async () => {
      const proverAddress = toUniversalAddress(
        padTo32Bytes('0x1234567890123456789012345678901234567890'),
      );
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: BigInt(1000000000000000000),
          tokens: [],
        },
      });

      const proofData = await prover.generateProof(intent);

      const expectedData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
          },
        ],
        [[pad(proverAddress as `0x${string}`), '0x', '0x0000000000000000000000000000000000000000']],
      );

      expect(proofData).toBe(expectedData);
    });
  });

  describe('getFee', () => {
    beforeEach(async () => {
      await prover.onModuleInit();
    });

    it('should get fee from destination chain using fetchProverFee', async () => {
      const intent = createMockIntent({
        destination: 10n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          deadline: 1234567890n,
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 100n,
          calls: [],
          tokens: [],
        },
      });

      const fee = await prover.getFee(intent, mockClaimant);

      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        10n, // destination chain
        intent,
        testAddress2, // contract address for chain 10
        expect.any(String), // proof data
        mockClaimant,
      );
      expect(fee).toBe(mockFee);
    });

    it('should throw error when blockchain reader is not initialized', async () => {
      prover['blockchainReaderService'] = undefined;

      const intent = createMockIntent();

      await expect(prover.getFee(intent, mockClaimant)).rejects.toThrow(
        "Cannot read properties of undefined (reading 'fetchProverFee')",
      );
    });
  });

  describe('integration with BaseProver', () => {
    it('should properly inherit isSupported method', () => {
      expect(prover.isSupported(1)).toBe(true);
      expect(prover.isSupported(10)).toBe(true);
      expect(prover.isSupported(999)).toBe(false);
    });

    it('should properly inherit getContractAddress method', () => {
      expect(prover.getContractAddress(1)).toBe(testAddress1);
      expect(prover.getContractAddress(10)).toBe(testAddress2);
      expect(prover.getContractAddress(999)).toBeUndefined();
    });

    it('should initialize blockchain reader on module init', async () => {
      await prover.onModuleInit();

      expect(mockModuleRef.get).toHaveBeenCalledWith(BlockchainReaderService, { strict: false });
      expect(prover['blockchainReaderService']).toBe(mockBlockchainReaderService);
    });
  });
});
