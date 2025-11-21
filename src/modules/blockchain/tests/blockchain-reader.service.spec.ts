import { Test, TestingModule } from '@nestjs/testing';

import { Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { padTo32Bytes, UniversalAddress } from '@/common/types/universal-address.type';
import {
  BlockchainConfigService,
  EvmConfigService,
  SolanaConfigService,
  TvmConfigService,
} from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

import { BlockchainReaderService } from '../blockchain-reader.service';
import { EvmReaderService } from '../evm/services/evm.reader.service';
import { SvmReaderService } from '../svm/services/svm.reader.service';

// Helper function to cast string to UniversalAddress
const toUniversalAddress = (address: string): UniversalAddress => address as UniversalAddress;
describe('BlockchainReaderService', () => {
  let service: BlockchainReaderService;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let solanaConfigService: jest.Mocked<SolanaConfigService>;
  let tvmConfigService: jest.Mocked<TvmConfigService>;
  let systemLogger: jest.Mocked<SystemLoggerService>;
  let evmReader: jest.Mocked<EvmReaderService>;
  let svmReader: jest.Mocked<SvmReaderService>;

  const mockIntent: Intent = {
    intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    destination: 10n,
    reward: {
      prover: toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890')),
      creator: toUniversalAddress(padTo32Bytes('0x0987654321098765432109876543210987654321')),
      deadline: 1234567890n,
      nativeAmount: 1000000000000000000n,
      tokens: [],
    },
    route: {
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      deadline: 1234567890n,
      portal: toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')),
      nativeAmount: 1000000000000000000n,
      calls: [],
      tokens: [],
    },
    status: IntentStatus.PENDING,
    sourceChainId: 1n,
  };

  beforeEach(async () => {
    blockchainConfigService = {
      getAllConfiguredChains: jest.fn().mockReturnValue([1, 10, 137, 1399811149, 1399811150]),
      getChainType: jest.fn().mockImplementation((chainId) => {
        const numericChainId = typeof chainId === 'bigint' ? Number(chainId) : chainId;
        if (
          numericChainId === 1399811149 ||
          numericChainId === 1399811150 ||
          numericChainId === 1399811151
        ) {
          return 'svm';
        }
        if (typeof numericChainId === 'number' && numericChainId < 1000000) {
          return 'evm';
        }
        return 'tvm';
      }),
      isChainSupported: jest.fn().mockImplementation((chainId) => {
        const supportedChains = [1, 10, 137, 1399811149, 1399811150];
        return supportedChains.includes(Number(chainId));
      }),
    } as any;

    evmConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
      supportedChainIds: [1, 10, 137],
    } as any;

    solanaConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
    } as any;

    tvmConfigService = {
      isConfigured: jest.fn().mockReturnValue(false),
      supportedChainIds: [],
    } as any;

    systemLogger = {
      setContext: jest.fn(),
    } as any;

    evmReader = {
      getBalance: jest.fn().mockResolvedValue(1000000000000000000n),
      getTokenBalance: jest.fn().mockResolvedValue(500000000000000000n),
      isIntentFunded: jest.fn().mockResolvedValue(true),
      fetchProverFee: jest.fn().mockResolvedValue(100000000000000000n),
    } as any;

    svmReader = {
      getBalance: jest.fn().mockResolvedValue(2000000000n),
      getTokenBalance: jest.fn().mockResolvedValue(1000000000n),
      isIntentFunded: jest.fn().mockResolvedValue(true),
      fetchProverFee: jest.fn().mockResolvedValue(50000000n),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainReaderService,
        { provide: BlockchainConfigService, useValue: blockchainConfigService },
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: SolanaConfigService, useValue: solanaConfigService },
        { provide: TvmConfigService, useValue: tvmConfigService },
        { provide: SystemLoggerService, useValue: systemLogger },
        { provide: EvmReaderService, useValue: evmReader },
        { provide: SvmReaderService, useValue: svmReader },
      ],
    }).compile();

    service = module.get<BlockchainReaderService>(BlockchainReaderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize EVM readers for configured chains', () => {
      const supportedChains = service.getSupportedChains();
      expect(supportedChains).toContain(1);
      expect(supportedChains).toContain(10);
      expect(supportedChains).toContain(137);
    });

    it('should not initialize readers when configs are not available', async () => {
      const emptyBlockchainConfigService = {
        getAllConfiguredChains: jest.fn().mockReturnValue([]),
        getChainType: jest.fn(),
        isChainSupported: jest.fn().mockReturnValue(false),
      } as any;

      evmConfigService.isConfigured.mockReturnValue(false);
      solanaConfigService.isConfigured.mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainReaderService,
          { provide: BlockchainConfigService, useValue: emptyBlockchainConfigService },
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: TvmConfigService, useValue: tvmConfigService },
          { provide: SystemLoggerService, useValue: systemLogger },
          { provide: EvmReaderService, useValue: evmReader },
          { provide: SvmReaderService, useValue: svmReader },
        ],
      }).compile();

      const newService = module.get<BlockchainReaderService>(BlockchainReaderService);
      expect(newService.getSupportedChains()).toEqual([]);
    });

    it('should handle missing optional readers', async () => {
      const emptyBlockchainConfigService = {
        getAllConfiguredChains: jest.fn().mockReturnValue([]),
        getChainType: jest.fn(),
        isChainSupported: jest.fn().mockReturnValue(false),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainReaderService,
          { provide: BlockchainConfigService, useValue: emptyBlockchainConfigService },
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: TvmConfigService, useValue: tvmConfigService },
          { provide: SystemLoggerService, useValue: systemLogger },
        ],
      }).compile();

      const newService = module.get<BlockchainReaderService>(BlockchainReaderService);
      expect(newService).toBeDefined();
      expect(newService.getSupportedChains()).toEqual([]);
    });
  });

  describe('getSupportedChains', () => {
    it('should return all supported chain IDs', () => {
      const supportedChains = service.getSupportedChains();
      expect(supportedChains).toContain(1);
      expect(supportedChains).toContain(10);
      expect(supportedChains).toContain(137);
      expect(supportedChains).toContain(1399811149);
      expect(supportedChains).toContain(1399811150);
    });
  });

  describe('isChainSupported', () => {
    it('should return true for supported EVM chains', () => {
      expect(service.isChainSupported(1)).toBe(true);
      expect(service.isChainSupported(10)).toBe(true);
      expect(service.isChainSupported(137)).toBe(true);
    });

    it('should return true for supported Solana chains', () => {
      expect(service.isChainSupported(1399811149)).toBe(true);
      expect(service.isChainSupported(1399811150)).toBe(true);
    });

    it('should return false for unsupported chains', () => {
      expect(service.isChainSupported(999)).toBe(false);
      expect(service.isChainSupported(888888888)).toBe(false);
    });

    it('should handle bigint chain IDs', () => {
      expect(service.isChainSupported(1n)).toBe(true);
      expect(service.isChainSupported(999n)).toBe(false);
    });
  });

  describe('getReaderForChain', () => {
    it('should return reader for supported chains', () => {
      expect(service.getReaderForChain(1)).toBeDefined();
      expect(service.getReaderForChain(1399811149)).toBeDefined();
    });

    it('should throw error for unsupported chains', () => {
      expect(() => service.getReaderForChain(999)).toThrow('No reader available for chain 999');
      expect(() => service.getReaderForChain(888888888)).toThrow(
        'No reader available for chain 888888888',
      );
    });

    it('should handle bigint chain IDs', () => {
      expect(service.getReaderForChain(1n)).toBeDefined();
      expect(() => service.getReaderForChain(999n)).toThrow('No reader available for chain 999');
    });
  });

  describe('getBalance', () => {
    it('should get balance for EVM chain', async () => {
      const testAddress = toUniversalAddress(
        padTo32Bytes('0x1234567890123456789012345678901234567890'),
      );
      const balance = await service.getBalance(1, testAddress);
      expect(balance).toBe(1000000000000000000n);
      expect(evmReader.getBalance).toHaveBeenCalledWith(testAddress, 1);
    });

    it('should get balance for Solana chain', async () => {
      const testAddress = toUniversalAddress('0x' + '1'.repeat(64)); // Valid 32-byte hex address for Solana
      const balance = await service.getBalance(1399811149, testAddress);
      expect(balance).toBe(2000000000n);
      expect(svmReader.getBalance).toHaveBeenCalledWith(testAddress, 1399811149);
    });

    it('should throw error for unsupported chain', async () => {
      const testAddress = toUniversalAddress(
        padTo32Bytes('0x1234567890123456789012345678901234567890'),
      );
      await expect(service.getBalance(999, testAddress)).rejects.toThrow(
        'No reader available for chain 999',
      );
    });
  });

  describe('getTokenBalance', () => {
    it('should get token balance for EVM chain', async () => {
      const tokenAddress = toUniversalAddress(
        padTo32Bytes('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
      );
      const walletAddress = toUniversalAddress(
        padTo32Bytes('0x1234567890123456789012345678901234567890'),
      );
      const balance = await service.getTokenBalance(1, tokenAddress, walletAddress);
      expect(balance).toBe(500000000000000000n);
      expect(evmReader.getTokenBalance).toHaveBeenCalledWith(tokenAddress, walletAddress, 1);
    });

    it('should get token balance for Solana chain', async () => {
      const tokenAddress = toUniversalAddress('0x' + '2'.repeat(64)); // Valid 32-byte hex address for Solana token
      const walletAddress = toUniversalAddress('0x' + '3'.repeat(64)); // Valid 32-byte hex address for Solana wallet
      const balance = await service.getTokenBalance(1399811149, tokenAddress, walletAddress);
      expect(balance).toBe(1000000000n);
      expect(svmReader.getTokenBalance).toHaveBeenCalledWith(
        tokenAddress,
        walletAddress,
        1399811149,
      );
    });

    it('should throw error for unsupported chain', async () => {
      const tokenAddress = toUniversalAddress(
        padTo32Bytes('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
      );
      const walletAddress = toUniversalAddress(
        padTo32Bytes('0x1234567890123456789012345678901234567890'),
      );
      await expect(service.getTokenBalance(999, tokenAddress, walletAddress)).rejects.toThrow(
        'No reader available for chain 999',
      );
    });
  });

  describe('isIntentFunded', () => {
    it('should check intent funding for EVM chain', async () => {
      const isFunded = await service.isIntentFunded(1, mockIntent);
      expect(isFunded).toBe(true);
      expect(evmReader.isIntentFunded).toHaveBeenCalledWith(mockIntent, 1);
    });

    it('should check intent funding for Solana chain', async () => {
      const isFunded = await service.isIntentFunded(1399811149, mockIntent);
      expect(isFunded).toBe(true);
      expect(svmReader.isIntentFunded).toHaveBeenCalledWith(mockIntent, 1399811149);
    });

    it('should throw error for unsupported chain', async () => {
      await expect(service.isIntentFunded(999, mockIntent)).rejects.toThrow(
        'No reader available for chain 999',
      );
    });
  });

  describe('fetchProverFee', () => {
    const prover = toUniversalAddress(padTo32Bytes('0x1234567890123456789012345678901234567890'));
    const messageData = '0x1234' as Hex;
    const claimant = toUniversalAddress(padTo32Bytes('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'));

    it('should fetch prover fee for EVM chain', async () => {
      const sourceDomainId = BigInt(1);
      const fee = await service.fetchProverFee(
        1,
        mockIntent,
        prover,
        messageData,
        sourceDomainId,
        claimant,
      );
      expect(fee).toBe(100000000000000000n);
      expect(evmReader.fetchProverFee).toHaveBeenCalledWith(
        mockIntent,
        prover,
        messageData,
        1,
        sourceDomainId,
        claimant,
      );
    });

    it('should fetch prover fee for Solana chain', async () => {
      const sourceDomainId = BigInt(1399811149);
      const fee = await service.fetchProverFee(
        1399811149,
        mockIntent,
        prover,
        messageData,
        sourceDomainId,
        claimant,
      );
      expect(fee).toBe(50000000n);
      expect(svmReader.fetchProverFee).toHaveBeenCalledWith(
        mockIntent,
        prover,
        messageData,
        1399811149,
        sourceDomainId,
        claimant,
      );
    });

    it('should fetch prover fee without claimant', async () => {
      const sourceDomainId = BigInt(1);
      const fee = await service.fetchProverFee(1, mockIntent, prover, messageData, sourceDomainId);
      expect(fee).toBe(100000000000000000n);
      expect(evmReader.fetchProverFee).toHaveBeenCalledWith(
        mockIntent,
        prover,
        messageData,
        1,
        sourceDomainId,
        undefined,
      );
    });

    it('should throw error for unsupported chain', async () => {
      await expect(
        service.fetchProverFee(999, mockIntent, prover, messageData, BigInt(999), claimant),
      ).rejects.toThrow('No reader available for chain 999');
    });
  });
});
