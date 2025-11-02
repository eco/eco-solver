import { Test, TestingModule } from '@nestjs/testing';

import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import {
  BlockchainConfigService,
  EvmConfigService,
  SolanaConfigService,
  TvmConfigService,
} from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { IntentsService } from '@/modules/intents/intents.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { BlockchainExecutorService } from '../blockchain-executor.service';
import { EvmExecutorService } from '../evm/services/evm.executor.service';
import { SvmExecutorService } from '../svm/services/svm.executor.service';

describe('BlockchainExecutorService', () => {
  let service: BlockchainExecutorService;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let solanaConfigService: jest.Mocked<SolanaConfigService>;
  let tvmConfigService: jest.Mocked<TvmConfigService>;
  let intentsService: jest.Mocked<IntentsService>;
  let systemLoggerService: jest.Mocked<SystemLoggerService>;
  let otelService: jest.Mocked<OpenTelemetryService>;
  let evmExecutor: jest.Mocked<EvmExecutorService>;
  let svmExecutor: jest.Mocked<SvmExecutorService>;

  const mockIntent: Intent = createMockIntent({
    destination: 10n, // Target chain is Optimism
  });

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

    intentsService = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as any;

    systemLoggerService = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    otelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            addEvent: jest.fn(),
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
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
        { provide: BlockchainConfigService, useValue: blockchainConfigService },
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: SolanaConfigService, useValue: solanaConfigService },
        { provide: TvmConfigService, useValue: tvmConfigService },
        { provide: IntentsService, useValue: intentsService },
        { provide: SystemLoggerService, useValue: systemLoggerService },
        { provide: OpenTelemetryService, useValue: otelService },
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
      expect(supportedChains).toContain(1399811149);
      expect(supportedChains).toContain(1399811150);
    });

    it('should not initialize executors when configs are not available', async () => {
      const emptyBlockchainConfigService = {
        getAllConfiguredChains: jest.fn().mockReturnValue([]),
        getChainType: jest.fn(),
        isChainSupported: jest.fn().mockReturnValue(false),
      } as any;

      evmConfigService.isConfigured.mockReturnValue(false);
      solanaConfigService.isConfigured.mockReturnValue(false);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainExecutorService,
          { provide: BlockchainConfigService, useValue: emptyBlockchainConfigService },
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: TvmConfigService, useValue: tvmConfigService },
          { provide: IntentsService, useValue: intentsService },
          { provide: SystemLoggerService, useValue: systemLoggerService },
          { provide: OpenTelemetryService, useValue: otelService },
          { provide: EvmExecutorService, useValue: evmExecutor },
          { provide: SvmExecutorService, useValue: svmExecutor },
        ],
      }).compile();

      const newService = module.get<BlockchainExecutorService>(BlockchainExecutorService);
      expect(newService.getSupportedChains()).toEqual([]);
    });

    it('should handle missing optional executors', async () => {
      const emptyBlockchainConfigService = {
        getAllConfiguredChains: jest.fn().mockReturnValue([]),
        getChainType: jest.fn(),
        isChainSupported: jest.fn().mockReturnValue(false),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BlockchainExecutorService,
          { provide: BlockchainConfigService, useValue: emptyBlockchainConfigService },
          { provide: EvmConfigService, useValue: evmConfigService },
          { provide: SolanaConfigService, useValue: solanaConfigService },
          { provide: TvmConfigService, useValue: tvmConfigService },
          { provide: IntentsService, useValue: intentsService },
          { provide: SystemLoggerService, useValue: systemLoggerService },
          { provide: OpenTelemetryService, useValue: otelService },
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
      const executor = service.getExecutorForChain(1399811149);
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
      const solanaIntent = createMockIntent({
        destination: BigInt(1399811149),
      });

      await service.executeIntent(solanaIntent);

      expect(svmExecutor.fulfill).toHaveBeenCalledWith(solanaIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        solanaIntent.intentHash,
        IntentStatus.FULFILLED,
      );
    });

    it('should handle failed execution', async () => {
      evmExecutor.fulfill.mockResolvedValue({ success: false, error: 'Execution failed' });

      await expect(service.executeIntent(mockIntent)).rejects.toThrow('Execution failed');

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FAILED,
      );
    });

    it('should handle execution errors', async () => {
      evmExecutor.fulfill.mockRejectedValue(new Error('Network error'));

      await expect(service.executeIntent(mockIntent)).rejects.toThrow('Network error');

      expect(evmExecutor.fulfill).toHaveBeenCalledWith(mockIntent, undefined);
      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        mockIntent.intentHash,
        IntentStatus.FAILED,
      );
    });

    it('should handle unsupported chain errors', async () => {
      const unsupportedIntent = createMockIntent({
        destination: 999n,
      });

      await expect(service.executeIntent(unsupportedIntent)).rejects.toThrow(
        'No executor for chain 999',
      );

      expect(intentsService.updateStatus).toHaveBeenCalledWith(
        unsupportedIntent.intentHash,
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
