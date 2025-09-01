import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { encodeAbiParameters, Hex, pad } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress, toUniversalAddress, padTo32Bytes } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { MetalayerProver } from '../../provers/metalayer.prover';

describe('MetalayerProver', () => {
  let prover: MetalayerProver;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890'));
  const testAddress2 = toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'));
  const mockFee = 2000000n;
  const mockClaimant = toUniversalAddress(padTo32Bytes('0x9999999999999999999999999999999999999999'));

  beforeEach(async () => {
    mockBlockchainReaderService = {
      fetchProverFee: jest.fn().mockResolvedValue(mockFee),
    } as unknown as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    mockBlockchainConfigService = {
      getProverAddress: jest.fn().mockImplementation((chainId: number | string | bigint, proverType: 'hyper' | 'metalayer') => {
        const numericChainId = Number(chainId);
        if (numericChainId === 137 && proverType === 'metalayer') {
          return testAddress1;
        }
        if (numericChainId === 8453 && proverType === 'metalayer') {
          return testAddress2;
        }
        return undefined;
      }),
    } as unknown as jest.Mocked<BlockchainConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetalayerProver,
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

    prover = module.get<MetalayerProver>(MetalayerProver);
  });

  describe('constructor', () => {
    it('should initialize with correct type and contract addresses', () => {
      expect(prover.type).toBe(ProverType.METALAYER);
      expect(prover.getContractAddress(137)).toBe(testAddress1);
      expect(prover.getContractAddress(8453)).toBe(testAddress2);
    });

    it('should handle empty chain configs', () => {
      const emptyConfigService = {
        getProverAddress: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<BlockchainConfigService>;
      const emptyProver = new MetalayerProver(emptyConfigService, mockModuleRef);

      expect(emptyProver.getContractAddress(137)).toBeUndefined();
      expect(emptyProver.isSupported(137)).toBe(false);
    });

    it('should handle chains with different prover types', () => {
      const mixedConfigService = {
        getProverAddress: jest.fn().mockImplementation((chainId: number | string | bigint, proverType: 'hyper' | 'metalayer') => {
          const numericChainId = Number(chainId);
          if (numericChainId === 1 && proverType === 'hyper') {
            return toUniversalAddress(padTo32Bytes('0x1111111111111111111111111111111111111111'));
          }
          if (numericChainId === 137 && proverType === 'metalayer') {
            return testAddress1;
          }
          return undefined;
        }),
      } as unknown as jest.Mocked<BlockchainConfigService>;

      const filteredProver = new MetalayerProver(mixedConfigService, mockModuleRef);
      expect(filteredProver.getContractAddress(137)).toBe(testAddress1);
      expect(filteredProver.getContractAddress(1)).toBeUndefined();
    });
  });

  describe('generateProof', () => {
    it('should encode prover address as bytes32', async () => {
      const proverAddress = toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890'));
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: BigInt(1000000000000000000),
          tokens: [],
        },
      });

      const messageData = await prover.generateProof(intent);
      const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(AddressNormalizer.denormalizeToEvm(proverAddress))]);

      expect(messageData).toBe(expectedData);
    });

    it('should handle different prover addresses', async () => {
      const testCases = [
        toUniversalAddress(padTo32Bytes('0x0000000000000000000000000000000000000001')),
        toUniversalAddress(padTo32Bytes('0xffffffffffffffffffffffffffffffffffffffff')),
        toUniversalAddress(padTo32Bytes('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')),
      ];

      for (const proverAddress of testCases) {
        const intent = createMockIntent({
          reward: {
            prover: proverAddress,
            creator: toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')),
            deadline: BigInt(Date.now() + 86400000),
            nativeAmount: BigInt(1000000000000000000),
            tokens: [],
          },
        });
        const messageData = await prover.generateProof(intent);
        const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(AddressNormalizer.denormalizeToEvm(proverAddress))]);

        expect(messageData).toBe(expectedData);
      }
    });

    it('should be consistent for the same prover address', async () => {
      const proverAddress = toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'));
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890')),
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: BigInt(1000000000000000000),
          tokens: [],
        },
      });

      const messageData1 = await prover.generateProof(intent);
      const messageData2 = await prover.generateProof(intent);

      expect(messageData1).toBe(messageData2);
    });
  });

  describe('getFee', () => {
    beforeEach(async () => {
      await prover.onModuleInit();
    });

    it('should get fee from source chain using fetchProverFee', async () => {
      const intent = createMockIntent({
        sourceChainId: 137n,
        destination: 8453n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
      });

      const fee = await prover.getFee(intent, mockClaimant);

      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        137n, // source chain (different from HyperProver which uses destination)
        intent,
        testAddress1, // contract address for metalayer on chain 137
        expect.any(String), // message data
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
      expect(prover.isSupported(137)).toBe(true);
      expect(prover.isSupported(8453)).toBe(true);
      expect(prover.isSupported(999)).toBe(false);
    });

    it('should properly inherit getContractAddress method', () => {
      expect(prover.getContractAddress(137)).toBe(testAddress1);
      expect(prover.getContractAddress(8453)).toBe(testAddress2);
      expect(prover.getContractAddress(999)).toBeUndefined();
    });

    it('should initialize blockchain reader on module init', async () => {
      await prover.onModuleInit();

      expect(mockModuleRef.get).toHaveBeenCalledWith(BlockchainReaderService, { strict: false });
      expect(prover['blockchainReaderService']).toBe(mockBlockchainReaderService);
    });
  });

  describe('differences from HyperProver', () => {
    it('uses simpler encoding than HyperProver', async () => {
      const intent = createMockIntent({
        sourceChainId: 137n,
        destination: 8453n,
        route: {
          salt: '0xdeadbeef' as Hex,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x7777777777777777777777777777777777777777')),
          nativeAmount: 0n,
          calls: [
            {
              target: toUniversalAddress(padTo32Bytes('0x1111111111111111111111111111111111111111')),
              data: '0x' as Hex,
              value: 100n,
            },
          ],
          tokens: [
            { token: toUniversalAddress(padTo32Bytes('0x2222222222222222222222222222222222222222')), amount: 1000n },
          ],
        },
      });

      const messageData = await prover.generateProof(intent);

      // MetalayerProver only uses reward.prover, ignoring other fields
      const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(AddressNormalizer.denormalizeToEvm(intent.reward.prover))]);
      expect(messageData).toBe(expectedData);
    });

    it('should use source chain for fee lookup instead of destination', async () => {
      await prover.onModuleInit();

      const intent = createMockIntent({
        sourceChainId: 137n,
        destination: 8453n,
        route: {
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          deadline: BigInt(Date.now() + 86400000),
          portal: toUniversalAddress(padTo32Bytes('0x9876543210987654321098765432109876543210')),
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
      });

      await prover.getFee(intent, mockClaimant);

      // Verify it uses source chain (137) not destination chain (8453)
      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        137n, // source chain
        intent,
        testAddress1, // contract address for metalayer on chain 137
        expect.any(String),
        mockClaimant,
      );
    });
  });
});
