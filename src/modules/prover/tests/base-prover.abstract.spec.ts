import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { Address, Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { ProverType } from '@/common/interfaces/prover.interface';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { Intent } from '@/common/interfaces/intent.interface';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';

// Concrete implementation for testing
class TestProver extends BaseProver {
  type = ProverType.HYPER;
  private testContractAddresses: Map<number, Address>;

  constructor(
    contractAddresses: Map<number, Address>,
    evmConfigService: EvmConfigService,
    moduleRef: ModuleRef,
  ) {
    super(evmConfigService, moduleRef);
    this.testContractAddresses = contractAddresses;
  }

  getContractAddress(chainId: number): Address | undefined {
    return this.testContractAddresses.get(chainId);
  }

  isSupported(chainId: number): boolean {
    return this.testContractAddresses.has(chainId);
  }

  async getMessageData(intent: Intent): Promise<Hex> {
    return '0xtest' as Hex;
  }

  async getFee(intent: Intent, claimant?: Address): Promise<bigint> {
    return 1000n;
  }
}

describe('BaseProver', () => {
  let prover: TestProver;
  let mockEvmConfigService: jest.Mocked<EvmConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = '0x1234567890123456789012345678901234567890' as Address;
  const testAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;

  beforeEach(async () => {
    mockBlockchainReaderService = {} as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    mockEvmConfigService = {} as jest.Mocked<EvmConfigService>;

    const contractAddresses = new Map<number, Address>([
      [1, testAddress1],
      [10, testAddress2],
    ]);

    prover = new TestProver(contractAddresses, mockEvmConfigService, mockModuleRef);
  });

  describe('onModuleInit', () => {
    it('should initialize blockchain reader service on module init', async () => {
      await prover.onModuleInit();

      expect(mockModuleRef.get).toHaveBeenCalledWith(BlockchainReaderService, { strict: false });
      expect(prover['blockchainReaderService']).toBe(mockBlockchainReaderService);
    });

    it('should handle missing blockchain reader service gracefully', async () => {
      mockModuleRef.get.mockReturnValueOnce(undefined);

      await expect(prover.onModuleInit()).resolves.not.toThrow();
      expect(prover['blockchainReaderService']).toBeUndefined();
    });
  });

  describe('getContractAddress', () => {
    it('should return contract address for supported chain', () => {
      const address = prover.getContractAddress(1);
      expect(address).toBe(testAddress1);
    });

    it('should return different address for different chain', () => {
      const address = prover.getContractAddress(10);
      expect(address).toBe(testAddress2);
    });

    it('should return undefined for unsupported chain', () => {
      const address = prover.getContractAddress(999);
      expect(address).toBeUndefined();
    });
  });

  describe('isSupported', () => {
    it('should return true for supported chain', () => {
      expect(prover.isSupported(1)).toBe(true);
      expect(prover.isSupported(10)).toBe(true);
    });

    it('should return false for unsupported chain', () => {
      expect(prover.isSupported(999)).toBe(false);
    });
  });

  describe('abstract methods', () => {
    it('should have type property', () => {
      expect(prover.type).toBe(ProverType.HYPER);
    });

    it('should implement getMessageData', async () => {
      const intent = createMockIntent();
      const result = await prover.getMessageData(intent);
      expect(result).toBe('0xtest');
    });

    it('should implement getFee', async () => {
      const intent = createMockIntent();
      const result = await prover.getFee(intent);
      expect(result).toBe(1000n);
    });
  });
});