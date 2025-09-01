import { ModuleRef } from '@nestjs/core';

import { Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmAddress } from '@/modules/blockchain/evm/types/address'; // Concrete implementation for testing
import { BlockchainConfigService } from '@/modules/config/services'; // Concrete implementation for testing
import { EvmConfigService } from '@/modules/config/services/evm-config.service';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';

// Concrete implementation for testing
class TestProver extends BaseProver {
  readonly type = ProverType.HYPER;

  constructor(blockchainConfigService: BlockchainConfigService, moduleRef: ModuleRef) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(_intent: Intent): Promise<Hex> {
    return '0xtest' as Hex;
  }

  async getFee(_intent: Intent, _claimant?: EvmAddress): Promise<bigint> {
    return 1000n;
  }

  getDeadlineBuffer(): bigint {
    return 3600n; // 1 hour buffer like HyperProver
  }
}

describe('BaseProver', () => {
  let prover: TestProver;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockModuleRef: jest.Mocked<ModuleRef>;
  let mockBlockchainReaderService: jest.Mocked<BlockchainReaderService>;

  const testAddress1 = '0x1234567890123456789012345678901234567890' as EvmAddress;
  const testAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as EvmAddress;

  beforeEach(async () => {
    mockBlockchainReaderService = {} as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    mockBlockchainConfigService = {
      getChain: jest.fn(),
    } as unknown as jest.Mocked<EvmConfigService>;

    // Setup mock return values for getChain
    mockBlockchainConfigService.getChain.mockImplementation((chainId: number) => {
      if (chainId === 1) {
        return { provers: { [ProverType.HYPER]: testAddress1 } } as any;
      }
      if (chainId === 10) {
        return { provers: { [ProverType.HYPER]: testAddress2 } } as any;
      }
      return undefined;
    });

    prover = new TestProver(mockBlockchainConfigService, mockModuleRef);
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

    it('should implement generateProof', async () => {
      const intent = createMockIntent();
      const result = await prover.generateProof(intent);
      expect(result).toBe('0xtest');
    });

    it('should implement getFee', async () => {
      const intent = createMockIntent();
      const result = await prover.getFee(intent);
      expect(result).toBe(1000n);
    });

    it('should implement getDeadlineBuffer', () => {
      const result = prover.getDeadlineBuffer();
      expect(result).toBe(3600n);
    });
  });
});
