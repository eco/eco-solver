import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { Address, encodeAbiParameters, Hex, pad } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { MetalayerProver } from '../../provers/metalayer.prover';

describe('MetalayerProver', () => {
  let prover: MetalayerProver;
  let mockEvmConfigService: jest.Mocked<EvmConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = '0x1234567890123456789012345678901234567890' as Address;
  const testAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
  const mockFee = 2000000n;
  const mockClaimant = '0x9999999999999999999999999999999999999999' as Address;

  beforeEach(async () => {
    mockBlockchainReaderService = {
      fetchProverFee: jest.fn().mockResolvedValue(mockFee),
    } as unknown as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    mockEvmConfigService = {
      getChain: jest.fn().mockImplementation((chainId: number) => {
        const chainConfigs: Record<number, any> = {
          137: { provers: { [ProverType.METALAYER]: testAddress1 } },
          8453: { provers: { [ProverType.METALAYER]: testAddress2 } },
        };
        return chainConfigs[chainId];
      }),
    } as unknown as jest.Mocked<EvmConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetalayerProver,
        {
          provide: EvmConfigService,
          useValue: mockEvmConfigService,
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
        getChain: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<EvmConfigService>;
      const emptyProver = new MetalayerProver(emptyConfigService, mockModuleRef);

      expect(emptyProver.getContractAddress(137)).toBeUndefined();
      expect(emptyProver.isSupported(137)).toBe(false);
    });

    it('should handle chains with different prover types', () => {
      const mixedConfigService = {
        getChain: jest.fn().mockImplementation((chainId: number) => {
          const chainConfigs: Record<number, any> = {
            1: { provers: { [ProverType.HYPER]: '0x1111111111111111111111111111111111111111' } },
            137: { provers: { [ProverType.METALAYER]: testAddress1 } },
          };
          return chainConfigs[chainId];
        }),
      } as unknown as jest.Mocked<EvmConfigService>;

      const filteredProver = new MetalayerProver(mixedConfigService, mockModuleRef);
      expect(filteredProver.getContractAddress(137)).toBe(testAddress1);
      expect(filteredProver.getContractAddress(1)).toBeUndefined();
    });
  });

  describe('generateProof', () => {
    it('should encode prover address as bytes32', async () => {
      const proverAddress = '0x1234567890123456789012345678901234567890' as Address;
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          deadline: BigInt(Date.now() + 86400000),
          nativeAmount: BigInt(1000000000000000000),
          tokens: [],
        },
      });

      const messageData = await prover.generateProof(intent);
      const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(proverAddress)]);

      expect(messageData).toBe(expectedData);
    });

    it('should handle different prover addresses', async () => {
      const testCases = [
        '0x0000000000000000000000000000000000000001' as Address,
        '0xffffffffffffffffffffffffffffffffffffffff' as Address,
        '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address,
      ];

      for (const proverAddress of testCases) {
        const intent = createMockIntent({
          reward: {
            prover: proverAddress,
            creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
            deadline: BigInt(Date.now() + 86400000),
            nativeAmount: BigInt(1000000000000000000),
            tokens: [],
          },
        });
        const messageData = await prover.generateProof(intent);
        const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(proverAddress)]);

        expect(messageData).toBe(expectedData);
      }
    });

    it('should be consistent for the same prover address', async () => {
      const proverAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: '0x1234567890123456789012345678901234567890' as Address,
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
          portal: '0x9876543210987654321098765432109876543210' as Address,
          nativeAmount: 0n,
          calls: [],
          tokens: [],
        },
      });

      const fee = await prover.getFee(intent, mockClaimant);

      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        137n, // source chain (different from HyperProver which uses destination)
        intent,
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
          portal: '0x7777777777777777777777777777777777777777' as Address,
          nativeAmount: 0n,
          calls: [
            {
              target: '0x1111111111111111111111111111111111111111' as Address,
              data: '0x' as Hex,
              value: 100n,
            },
          ],
          tokens: [
            { token: '0x2222222222222222222222222222222222222222' as Address, amount: 1000n },
          ],
        },
      });

      const messageData = await prover.generateProof(intent);

      // MetalayerProver only uses reward.prover, ignoring other fields
      const expectedData = encodeAbiParameters([{ type: 'bytes32' }], [pad(intent.reward.prover)]);
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
          portal: '0x9876543210987654321098765432109876543210' as Address,
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
        expect.any(String),
        mockClaimant,
      );
    });
  });
});
