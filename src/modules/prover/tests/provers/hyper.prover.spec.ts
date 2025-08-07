import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { Address, encodeAbiParameters, Hex, pad } from 'viem';

import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

import { HyperProver } from '../../provers/hyper.prover';

describe('HyperProver', () => {
  let prover: HyperProver;
  let mockEvmConfigService: jest.Mocked<EvmConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = '0x1234567890123456789012345678901234567890' as Address;
  const testAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
  const mockFee = 1000000n;
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
          1: { provers: { [ProverType.HYPER]: testAddress1 } },
          10: { provers: { [ProverType.HYPER]: testAddress2 } },
        };
        return chainConfigs[chainId];
      }),
    } as unknown as jest.Mocked<EvmConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperProver,
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
        getChain: jest.fn().mockReturnValue(undefined),
      } as unknown as jest.Mocked<EvmConfigService>;
      const emptyProver = new HyperProver(emptyConfigService, mockModuleRef);

      expect(emptyProver.getContractAddress(1)).toBeUndefined();
      expect(emptyProver.isSupported(1)).toBe(false);
    });
  });

  describe('getMessageData', () => {
    it('should encode message data correctly for intent', async () => {
      const proverAddress = '0x3333333333333333333333333333333333333333' as Address;
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: '0x4444444444444444444444444444444444444444' as Address,
          deadline: 1234567890n,
          nativeValue: 200n,
          tokens: [],
        },
      });

      const messageData = await prover.getMessageData(intent);

      // Verify the structure matches the actual implementation
      const expectedData = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        [pad(proverAddress), '0x', '0x0000000000000000000000000000000000000000'],
      );

      expect(messageData).toBe(expectedData);
    });

    it('should handle different prover addresses', async () => {
      const proverAddress = '0x1234567890123456789012345678901234567890' as Address;
      const intent = createMockIntent({
        reward: {
          prover: proverAddress,
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
          deadline: BigInt(Date.now() + 86400000),
          nativeValue: BigInt(1000000000000000000),
          tokens: [],
        },
      });

      const messageData = await prover.getMessageData(intent);

      const expectedData = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        [pad(proverAddress), '0x', '0x0000000000000000000000000000000000000000'],
      );

      expect(messageData).toBe(expectedData);
    });
  });

  describe('getFee', () => {
    beforeEach(async () => {
      await prover.onModuleInit();
    });

    it('should get fee from destination chain using fetchProverFee', async () => {
      const intent = createMockIntent({
        route: {
          source: 1n,
          destination: 10n,
          salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
          inbox: '0x9876543210987654321098765432109876543210' as Address,
          calls: [],
          tokens: [],
        },
      });

      const fee = await prover.getFee(intent, mockClaimant);

      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        10n, // destination chain
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
