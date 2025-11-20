import { ModuleRef } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { encodeAbiParameters, Hex } from 'viem';

import { ProverType, TProverType } from '@/common/interfaces/prover.interface';
import { padTo32Bytes, UniversalAddress } from '@/common/types/universal-address.type';
import { CcipProverConfig } from '@/config/schemas/provers.schema';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService, ProversConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { CcipProver } from '@/modules/prover/provers/ccip.prover';

const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;

describe('CcipProver', () => {
  let prover: CcipProver;
  let mockBlockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let mockProversConfigService: jest.Mocked<ProversConfigService>;
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

  const defaultCcipConfig: CcipProverConfig = {
    gasLimit: 300000,
    allowOutOfOrderExecution: true,
    deadlineBuffer: 7200, // 2 hours
    chainSelectors: {
      8453: '15971525489660198786',
      1: '5009297550715157269',
      2020: '6916147374840168594',
      10: '3734403246176062136',
      137: '4051577828743386545',
    },
  };

  const customCcipConfig: Partial<CcipProverConfig> = {
    gasLimit: 500000,
    allowOutOfOrderExecution: false,
    deadlineBuffer: 3600, // 1 hour
  };

  beforeEach(async () => {
    mockBlockchainReaderService = {
      fetchProverFee: jest.fn().mockResolvedValue(mockFee),
    } as unknown as jest.Mocked<BlockchainReaderService>;

    mockModuleRef = {
      get: jest.fn().mockReturnValue(mockBlockchainReaderService),
    } as unknown as jest.Mocked<ModuleRef>;

    // Create additional test addresses for different chains
    const testAddress8453 = toUniversalAddress(
      padTo32Bytes('0x8888888888888888888888888888888888888888'),
    );
    const testAddress137 = toUniversalAddress(
      padTo32Bytes('0x9999999999999999999999999999999999999999'),
    );

    mockBlockchainConfigService = {
      getProverAddress: jest
        .fn()
        .mockImplementation((chainId: number | string | bigint, proverType: TProverType) => {
          const numericChainId = Number(chainId);
          if (proverType !== 'ccip') return undefined;

          const addressMap: Record<number, UniversalAddress> = {
            1: testAddress1,
            10: testAddress2,
            8453: testAddress8453,
            137: testAddress137,
          };

          return addressMap[numericChainId];
        }),
    } as unknown as jest.Mocked<BlockchainConfigService>;

    mockProversConfigService = {
      getCcipGasLimit: jest.fn().mockReturnValue(defaultCcipConfig.gasLimit),
      getCcipAllowOutOfOrderExecution: jest
        .fn()
        .mockReturnValue(defaultCcipConfig.allowOutOfOrderExecution),
      getCcipDeadlineBuffer: jest.fn().mockReturnValue(defaultCcipConfig.deadlineBuffer),
      getCcipChainSelector: jest.fn().mockImplementation((chainId: number) => {
        return defaultCcipConfig.chainSelectors[chainId];
      }),
      ccip: defaultCcipConfig,
    } as unknown as jest.Mocked<ProversConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CcipProver,
        {
          provide: BlockchainConfigService,
          useValue: mockBlockchainConfigService,
        },
        {
          provide: ModuleRef,
          useValue: mockModuleRef,
        },
        {
          provide: ProversConfigService,
          useValue: mockProversConfigService,
        },
      ],
    }).compile();

    prover = module.get<CcipProver>(CcipProver);
  });

  describe('constructor', () => {
    it('should initialize with correct type and contract addresses', () => {
      expect(prover.type).toBe(ProverType.CCIP);
      expect(prover.getContractAddress(1)).toBe(testAddress1);
      expect(prover.getContractAddress(10)).toBe(testAddress2);
    });

    it('should handle chains with no CCIP prover configured', () => {
      expect(prover.getContractAddress(999)).toBeUndefined();
      expect(prover.isSupported(999)).toBe(false);
    });
  });

  describe('generateProof', () => {
    it('should encode proof data with source prover address and default config', async () => {
      const intent = createMockIntent({
        sourceChainId: 1n,
      });

      const proofData = await prover.generateProof(intent);

      // Proof contains source chain prover address, not chain selector
      const expectedData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }],
          },
        ],
        [['0x1234567890123456789012345678901234567890', 300000n, true]],
      );

      expect(proofData).toBe(expectedData);
      expect(mockProversConfigService.getCcipGasLimit).toHaveBeenCalled();
      expect(mockProversConfigService.getCcipAllowOutOfOrderExecution).toHaveBeenCalled();
      expect(mockBlockchainConfigService.getProverAddress).toHaveBeenCalledWith(1, 'ccip');
    });

    it('should encode proof data with custom configuration', async () => {
      mockProversConfigService.getCcipGasLimit.mockReturnValue(customCcipConfig.gasLimit!);
      mockProversConfigService.getCcipAllowOutOfOrderExecution.mockReturnValue(
        customCcipConfig.allowOutOfOrderExecution!,
      );

      const intent = createMockIntent({
        sourceChainId: 10n,
      });

      const proofData = await prover.generateProof(intent);

      // Proof contains source chain prover address for chain 10
      const expectedData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }],
          },
        ],
        [['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 500000n, false]],
      );

      expect(proofData).toBe(expectedData);
      expect(mockProversConfigService.getCcipGasLimit).toHaveBeenCalled();
      expect(mockProversConfigService.getCcipAllowOutOfOrderExecution).toHaveBeenCalled();
      expect(mockBlockchainConfigService.getProverAddress).toHaveBeenCalledWith(10, 'ccip');
    });

    it('should handle different source chain IDs correctly', async () => {
      const testCases = [
        { chainId: 1n, expectedAddress: '0x1234567890123456789012345678901234567890' }, // Ethereum
        { chainId: 10n, expectedAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' }, // Optimism
        { chainId: 137n, expectedAddress: '0x9999999999999999999999999999999999999999' }, // Polygon
        { chainId: 8453n, expectedAddress: '0x8888888888888888888888888888888888888888' }, // Base
      ];

      for (const { chainId, expectedAddress } of testCases) {
        const intent = createMockIntent({
          sourceChainId: chainId,
        });

        const proofData = await prover.generateProof(intent);

        const expectedData = encodeAbiParameters(
          [
            {
              type: 'tuple',
              components: [{ type: 'address' }, { type: 'uint256' }, { type: 'bool' }],
            },
          ],
          [[expectedAddress as Hex, 300000n, true]],
        );

        expect(proofData).toBe(expectedData);
      }
    });
  });

  describe('getDeadlineBuffer', () => {
    it('should return default deadline buffer (7200 seconds / 2 hours)', () => {
      expect(prover.getDeadlineBuffer(1)).toBe(7200n);
      expect(mockProversConfigService.getCcipDeadlineBuffer).toHaveBeenCalled();
    });

    it('should return custom deadline buffer when configured', () => {
      mockProversConfigService.getCcipDeadlineBuffer.mockReturnValue(
        customCcipConfig.deadlineBuffer!,
      );
      expect(prover.getDeadlineBuffer(10)).toBe(3600n); // Custom config has 1 hour
      expect(mockProversConfigService.getCcipDeadlineBuffer).toHaveBeenCalled();
    });

    it('should use global configuration for all chains', () => {
      const globalDeadlineBuffer = 10800; // 3 hours
      mockProversConfigService.getCcipDeadlineBuffer.mockReturnValue(globalDeadlineBuffer);

      expect(prover.getDeadlineBuffer(8453)).toBe(10800n);
      expect(mockProversConfigService.getCcipDeadlineBuffer).toHaveBeenCalled();
    });
  });

  describe('getFee', () => {
    beforeEach(async () => {
      await prover.onModuleInit();
    });

    it('should get fee from destination chain using fetchProverFee', async () => {
      const intent = createMockIntent({
        sourceChainId: 1n,
        destination: 10n,
      });

      const fee = await prover.getFee(intent, mockClaimant);

      expect(mockBlockchainReaderService.fetchProverFee).toHaveBeenCalledWith(
        10n, // destination chain
        intent,
        testAddress2, // contract address for chain 10
        expect.any(String), // proof data
        5009297550715157269n, // source domain ID (CCIP chain selector for Ethereum)
        mockClaimant,
      );
      expect(fee).toBe(mockFee);
    });

    it('should throw error if BlockchainReaderService not initialized', async () => {
      const uninitializedProver = new CcipProver(
        mockBlockchainConfigService,
        mockModuleRef,
        mockProversConfigService,
      );

      const intent = createMockIntent({
        destination: 10n,
      });

      await expect(uninitializedProver.getFee(intent, mockClaimant)).rejects.toThrow();
    });
  });

  describe('integration with BaseProver', () => {
    it('should correctly implement isSupported method', () => {
      expect(prover.isSupported(1)).toBe(true);
      expect(prover.isSupported(10)).toBe(true);
      expect(prover.isSupported(999)).toBe(false);
    });

    it('should correctly implement getContractAddress method', () => {
      expect(prover.getContractAddress(1)).toBe(testAddress1);
      expect(prover.getContractAddress(10)).toBe(testAddress2);
      expect(prover.getContractAddress(999)).toBeUndefined();
    });

    it('should initialize BlockchainReaderService on module init', async () => {
      await prover.onModuleInit();
      expect(mockModuleRef.get).toHaveBeenCalledWith(BlockchainReaderService, {
        strict: false,
      });
    });
  });
});
