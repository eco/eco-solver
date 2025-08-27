import { Test, TestingModule } from '@nestjs/testing';

import { Address, Hex } from 'viem';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { EvmConfigService, SolanaConfigService } from '@/modules/config/services';
import { IntentsService } from '@/modules/intents/intents.service';

import { BlockchainExecutorService } from '../blockchain-executor.service';
import { EvmExecutorService } from '../evm/services/evm.executor.service';
import { SvmExecutorService } from '../svm/services/svm.executor.service';

describe('BlockchainExecutorService', () => {
  let service: BlockchainExecutorService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let solanaConfigService: jest.Mocked<SolanaConfigService>;
  let intentsService: jest.Mocked<IntentsService>;
  let evmExecutor: jest.Mocked<EvmExecutorService>;
  let svmExecutor: jest.Mocked<SvmExecutorService>;

  const mockIntent: Intent = {
    intentHash: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    reward: {
      prover: '0x1234567890123456789012345678901234567890' as Address,
      creator: '0x0987654321098765432109876543210987654321' as Address,
      deadline: 1234567890n,
      nativeAmount: 1000000000000000000n,
      tokens: [],
    },
    route: {
      source: 1n,
      destination: 10n,
      salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
      inbox: '0xabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      calls: [],
      tokens: [],
    },
    status: IntentStatus.PENDING,
  };

  beforeEach(async () => {
    evmConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
      supportedChainIds: [1, 10, 137],
    } as any;

    solanaConfigService = {
      isConfigured: jest.fn().mockReturnValue(true),
    } as any;

    intentsService = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as any;

    evmExecutor = {
      fulfill: jest.fn().mockResolvedValue({ success: true, txHash: '0x123' }),
    } as any;

    svmExecutor = {
      fulfill: jest.fn().mockResolvedValue({ success: true, txHash: 'solana-tx-hash' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainExecutorService,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: SolanaConfigService, useValue: solanaConfigService },
        { provide: IntentsService, useValue: intentsService },
        { provide: EvmExecutorService, useValue: evmExecutor },
        { provide: SvmExecutorService, useValue: svmExecutor },
      ],
    }).compile();

    service = module.get<BlockchainExecutorService>(BlockchainExecutorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize EVM executors for configured chains', () => {
      const supportedChains = service.getSupportedChains();
      expect(supportedChains).toContain(1);
      expect(supportedChains).toContain(10);
      expect(supportedChains).toContain(137);
    });

    it('should initialize SVM executors for configured chains', () => {
      const supportedChains = service.getSupportedChains();
      expect(supportedChains).toContain('solana-mainnet');
      expect(supportedChains).toContain('solana-devnet');
    });

    it('should not initialize executors when configs are not available', async () => {
      evmConfigService.isConfigured.mockReturnValue(false);
      solanaConfigService.isConfigured.mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainExecutorService,
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: IntentsService, useValue: intentsService },
          { provide: EvmExecutorService, useValue: evmExecutor },
          { provide: SvmExecutorService, useValue: svmExecutor },
        ],
      }).compile();

      const newService = module.get<BlockchainExecutorService>(BlockchainExecutorService);
      expect(newService.getSupportedChains()).toEqual([]);
    });

    it('should handle missing optional executors', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainExecutorService,
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: IntentsService, useValue: intentsService },
        ],
      }).compile();

      const newService = module.get<BlockchainExecutorService>(BlockchainExecutorService);
      expect(newService).toBeDefined();
      expect(newService.getSupportedChains()).toEqual([]);
    });
  });

  describe('getSupportedChains', () => {
    it('should return all supported chain IDs', () => {
      const supportedChains = service.getSupportedChains();
      expect(supportedChains).toHaveLength(5);
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

  describe('getExecutorForChain', () => {
    it('should return executor for supported EVM chains', () => {
      const executor = service.getExecutorForChain(1);
      expect(executor).toBe(evmExecutor);
    });

    it('should return executor for supported Solana chains', () => {
      const executor = service.getExecutorForChain('solana-mainnet');
      expect(executor).toBe(svmExecutor);
    });

    it('should throw error for unsupported chains', () => {
      expect(() => service.getExecutorForChain(999)).toThrow('No executor for chain 999');
      expect(() => service.getExecutorForChain('unsupported-chain')).toThrow(
        'No executor for chain unsupported-chain',
      );
    });

    it('should handle bigint chain IDs', () => {
      const executor = service.getExecutorForChain(10n);
      expect(executor).toBe(evmExecutor);
    });
  });

  describe('executeIntent', () => {
    it('should execute intent successfully on EVM chain', async () => {
      await service.executeIntent(mockIntent, 'basic' as WalletType);

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, 'basic');
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FULFILLED,
      );
    });

    it('should execute intent successfully on Solana chain', async () => {
      const solanaIntent = {
        ...mockIntent,
        route: {
          ...mockIntent.route,
          destination: 'solana-mainnet' as any,
        },
      };

      await service.executeIntent(solanaIntent);

      expect(svmExecutor.fulfill).toHaveBeenCalledWith(solanaIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FULFILLED,
      );
    });

    it('should handle failed execution', async () => {
      evmExecutor.fulfill.mockResolvedValue({ success: false, error: 'Execution failed' });

      await service.executeIntent(mockIntent);

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FAILED,
      );
    });

    it('should handle execution errors', async () => {
      evmExecutor.fulfill.mockRejectedValue(new Error('Network error'));

      await service.executeIntent(mockIntent);

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FAILED,
      );
    });

    it('should handle unsupported chain errors', async () => {
      const unsupportedIntent = {
        ...mockIntent,
        route: {
          ...mockIntent.route,
          destination: 999n,
        },
      };

      await service.executeIntent(unsupportedIntent);

      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FAILED,
      );
    });

    it('should pass wallet ID to executor', async () => {
      const walletId: WalletType = 'kernel';
      await service.executeIntent(mockIntent, walletId);

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, walletId);
    });
  });
});
