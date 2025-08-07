import { Test, TestingModule } from '@nestjs/testing';

import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';

import { BlockchainReaderService } from '../blockchain-reader.service';
import { EvmReaderService } from '../evm/services/evm.reader.service';
import { SvmReaderService } from '../svm/services/svm.reader.service';

describe('BlockchainReaderService', () => {
  let service: BlockchainReaderService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let solanaConfigService: jest.Mocked<SolanaConfigService>;
  let evmReader: jest.Mocked<EvmReaderService>;
  let svmReader: jest.Mocked<SvmReaderService>;

  const mockIntent: Intent = {
    intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0x0987654321098765432109876543210987654321' as Address,
      deadline: 1234567890n,
      nativeValue: 1000000000000000000n,
      tokens: []
    },
    route: {
      source: 1n,
      destination: 10n,
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      inbox: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      calls: [],
      tokens: []
    },
    status: IntentStatus.PENDING
  };

  beforeEach(async () => {
    evmConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
      supportedChainIds: [1, 10, 137]
    } as any;

    solanaConfigService = {
      isConfigured: jest.fn().mockReturnValue(true)
    } as any;

    evmReader = {
      getBalance: jest.fn().mockResolvedValue(1000000000000000000n),
      getTokenBalance: jest.fn().mockResolvedValue(500000000000000000n),
      isAddressValid: jest.fn().mockReturnValue(true),
      isIntentFunded: jest.fn().mockResolvedValue(true),
      fetchProverFee: jest.fn().mockResolvedValue(100000000000000000n)
    } as any;

    svmReader = {
      getBalance: jest.fn().mockResolvedValue(2000000000n),
      getTokenBalance: jest.fn().mockResolvedValue(1000000000n),
      isAddressValid: jest.fn().mockReturnValue(true),
      isIntentFunded: jest.fn().mockResolvedValue(true),
      fetchProverFee: jest.fn().mockResolvedValue(50000000n)
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainReaderService,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: SolanaConfigService, useValue: solanaConfigService },
        { provide: EvmReaderService, useValue: evmReader },
        { provide: SvmReaderService, useValue: svmReader }
      ]
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
      evmConfigService.isConfigured.mockReturnValue(false);
      solanaConfigService.isConfigured.mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainReaderService,
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: EvmReaderService, useValue: evmReader },
          { provide: SvmReaderService, useValue: svmReader }
        ]
      }).compile();

      const newService = module.get<BlockchainReaderService>(BlockchainReaderService);
      expect(newService.getSupportedChains()).toEqual([]);
    });

    it('should handle missing optional readers', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainReaderService,
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService }
        ]
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
      expect(supportedChains).toContain('solana-mainnet');
      expect(supportedChains).toContain('solana-devnet');
    });
  });

  describe('isChainSupported', () => {
    it('should return true for supported EVM chains', () => {
      expect(service.isChainSupported(1)).toBe(true);
      expect(service.isChainSupported(10)).toBe(true);
      expect(service.isChainSupported(137)).toBe(true);
    });

    it('should return true for supported Solana chains', () => {
      expect(service.isChainSupported('solana-mainnet')).toBe(true);
      expect(service.isChainSupported('solana-devnet')).toBe(true);
    });

    it('should return false for unsupported chains', () => {
      expect(service.isChainSupported(999)).toBe(false);
      expect(service.isChainSupported('unsupported-chain')).toBe(false);
    });

    it('should handle bigint chain IDs', () => {
      expect(service.isChainSupported(1n)).toBe(true);
      expect(service.isChainSupported(999n)).toBe(false);
    });
  });

  describe('getReaderForChain', () => {
    it('should return reader for supported chains', () => {
      expect(service.getReaderForChain(1)).toBeDefined();
      expect(service.getReaderForChain('solana-mainnet')).toBeDefined();
    });

    it('should return undefined for unsupported chains', () => {
      expect(service.getReaderForChain(999)).toBeUndefined();
      expect(service.getReaderForChain('unsupported-chain')).toBeUndefined();
    });

    it('should handle bigint chain IDs', () => {
      expect(service.getReaderForChain(1n)).toBeDefined();
      expect(service.getReaderForChain(999n)).toBeUndefined();
    });
  });

  describe('getBalance', () => {
    it('should get balance for EVM chain', async () => {
      const balance = await service.getBalance(1, '0x1234567890123456789012345678901234567890');
      expect(balance).toBe(1000000000000000000n);
      expect(evmReader.getBalance).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890', 1);
    });

    it('should get balance for Solana chain', async () => {
      const balance = await service.getBalance('solana-mainnet', 'So11111111111111111111111111111111111111112');
      expect(balance).toBe(2000000000n);
      expect(svmReader.getBalance).toHaveBeenCalledWith('So11111111111111111111111111111111111111112', 'solana-mainnet');
    });

    it('should throw error for unsupported chain', async () => {
      await expect(
        service.getBalance(999, '0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('No reader available for chain 999');
    });

    it('should handle bigint chain IDs', async () => {
      const balance = await service.getBalance(1n, '0x1234567890123456789012345678901234567890');
      expect(balance).toBe(1000000000000000000n);
    });
  });

  describe('getTokenBalance', () => {
    it('should get token balance for EVM chain', async () => {
      const balance = await service.getTokenBalance(
        1,
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x1234567890123456789012345678901234567890'
      );
      expect(balance).toBe(500000000000000000n);
      expect(evmReader.getTokenBalance).toHaveBeenCalledWith(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x1234567890123456789012345678901234567890',
        1
      );
    });

    it('should get token balance for Solana chain', async () => {
      const balance = await service.getTokenBalance(
        'solana-mainnet',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'So11111111111111111111111111111111111111112'
      );
      expect(balance).toBe(1000000000n);
      expect(svmReader.getTokenBalance).toHaveBeenCalledWith(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'So11111111111111111111111111111111111111112',
        'solana-mainnet'
      );
    });

    it('should throw error for unsupported chain', async () => {
      await expect(
        service.getTokenBalance(
          999,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          '0x1234567890123456789012345678901234567890'
        )
      ).rejects.toThrow('No reader available for chain 999');
    });
  });

  describe('isAddressValid', () => {
    it('should validate address for EVM chain', () => {
      const isValid = service.isAddressValid(1, '0x1234567890123456789012345678901234567890');
      expect(isValid).toBe(true);
      expect(evmReader.isAddressValid).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should validate address for Solana chain', () => {
      const isValid = service.isAddressValid('solana-mainnet', 'So11111111111111111111111111111111111111112');
      expect(isValid).toBe(true);
      expect(svmReader.isAddressValid).toHaveBeenCalledWith('So11111111111111111111111111111111111111112');
    });

    it('should return false for unsupported chain', () => {
      const isValid = service.isAddressValid(999, '0x1234567890123456789012345678901234567890');
      expect(isValid).toBe(false);
    });
  });

  describe('isIntentFunded', () => {
    it('should check intent funding for EVM chain', async () => {
      const isFunded = await service.isIntentFunded(1, mockIntent);
      expect(isFunded).toBe(true);
      expect(evmReader.isIntentFunded).toHaveBeenCalledWith(mockIntent, 1);
    });

    it('should check intent funding for Solana chain', async () => {
      const isFunded = await service.isIntentFunded('solana-mainnet', mockIntent);
      expect(isFunded).toBe(true);
      expect(svmReader.isIntentFunded).toHaveBeenCalledWith(mockIntent, 'solana-mainnet');
    });

    it('should throw error for unsupported chain', async () => {
      await expect(
        service.isIntentFunded(999, mockIntent)
      ).rejects.toThrow('No reader available for chain 999');
    });
  });

  describe('fetchProverFee', () => {
    const messageData = '0x1234' as Hex;
    const claimant = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;

    it('should fetch prover fee for EVM chain', async () => {
      const fee = await service.fetchProverFee(1, mockIntent, messageData, claimant);
      expect(fee).toBe(100000000000000000n);
      expect(evmReader.fetchProverFee).toHaveBeenCalledWith(mockIntent, messageData, 1, claimant);
    });

    it('should fetch prover fee for Solana chain', async () => {
      const fee = await service.fetchProverFee('solana-mainnet', mockIntent, messageData, claimant);
      expect(fee).toBe(50000000n);
      expect(svmReader.fetchProverFee).toHaveBeenCalledWith(mockIntent, messageData, 'solana-mainnet', claimant);
    });

    it('should fetch prover fee without claimant', async () => {
      const fee = await service.fetchProverFee(1, mockIntent, messageData);
      expect(fee).toBe(100000000000000000n);
      expect(evmReader.fetchProverFee).toHaveBeenCalledWith(mockIntent, messageData, 1, undefined);
    });

    it('should throw error for unsupported chain', async () => {
      await expect(
        service.fetchProverFee(999, mockIntent, messageData, claimant)
      ).rejects.toThrow('No reader available for chain 999');
    });
  });
});