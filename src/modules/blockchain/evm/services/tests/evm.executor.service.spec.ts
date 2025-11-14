import { Test, TestingModule } from '@nestjs/testing';

import { Address } from 'viem';
import * as viem from 'viem';

import { ExecutionResult } from '@/common/abstractions/base-chain-executor.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { PortalHashUtils } from '@/common/utils/portal-hash.utils';
import { BlockchainConfigService, EvmConfigService } from '@/modules/config/services';
import { createMockIntent } from '@/modules/fulfillment/validations/test-helpers';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';
import { ProverService } from '@/modules/prover/prover.service';

import { EvmExecutorService } from '../evm.executor.service';
import { EvmTransportService } from '../evm-transport.service';
import { EvmWalletManager, WalletType } from '../evm-wallet-manager.service';

jest.mock('@/common/utils/portal-hash.utils', () => ({
  PortalHashUtils: {
    getIntentHash: jest.fn(),
    computeRewardHash: jest.fn().mockReturnValue('0xRewardHash'),
  },
}));

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    encodeFunctionData: jest.fn(),
  };
});

jest.mock('@/common/utils/chain-type-detector', () => ({
  ChainTypeDetector: {
    detect: jest.fn().mockReturnValue('evm'),
  },
}));

describe('EvmExecutorService', () => {
  let service: EvmExecutorService;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let blockchainConfigService: jest.Mocked<BlockchainConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;
  let walletManager: jest.Mocked<EvmWalletManager>;
  let proverService: jest.Mocked<ProverService>;

  const mockIntent: Intent = createMockIntent({
    sourceChainId: 1n,
    destination: 10n,
  });

  const mockWallet = {
    getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    writeContracts: jest.fn().mockResolvedValue(['0xTransactionHash']),
  };

  const mockProver = {
    getContractAddress: jest
      .fn()
      .mockReturnValue('0x0000000000000000000000009999999999999999999999999999999999999999' as any),
    getFee: jest.fn().mockResolvedValue(100000000000000000n),
    generateProof: jest.fn().mockResolvedValue('0xProofData'),
  };

  const mockPublicClient = {
    waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
    getBalance: jest.fn().mockResolvedValue(1000000000000000000n),
    getTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
  };

  beforeEach(async () => {
    evmConfigService = {
      getChain: jest.fn().mockReturnValue({
        chainId: 10,
        portalAddress: '0xInboxAddress',
      }),
      getInboxAddress: jest.fn().mockReturnValue('0xInboxAddress' as Address),
      getPortalAddress: jest
        .fn()
        .mockReturnValue(
          '0x0000000000000000000000001111111111111111111111111111111111111111' as any,
        ),
    } as any;

    blockchainConfigService = {
      getClaimant: jest
        .fn()
        .mockReturnValue('0x0000000000000000000000001234567890123456789012345678901234567890'),
    } as any;

    transportService = {
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    } as any;

    walletManager = {
      getWallet: jest.fn().mockReturnValue(mockWallet),
      getWalletAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    } as any;

    proverService = {
      getProver: jest.fn().mockReturnValue(mockProver),
    } as any;

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            addEvent: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvmExecutorService,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: BlockchainConfigService, useValue: blockchainConfigService },
        { provide: EvmTransportService, useValue: transportService },
        { provide: EvmWalletManager, useValue: walletManager },
        { provide: ProverService, useValue: proverService },
        { provide: SystemLoggerService, useValue: mockLogger },
        { provide: OpenTelemetryService, useValue: mockOtelService },
      ],
    }).compile();

    service = module.get<EvmExecutorService>(EvmExecutorService);

    // Reset mocks
    jest.clearAllMocks();
    (PortalHashUtils.getIntentHash as jest.Mock).mockReturnValue({
      intentHash: '0xIntentHash',
      rewardHash: '0xRewardHash',
    });
    (viem.encodeFunctionData as jest.Mock).mockReturnValue('0xEncodedData');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fulfill', () => {
    it('should fulfill intent successfully', async () => {
      const walletType: WalletType = 'basic';
      const result = await service.fulfill(mockIntent, walletType);

      expect(result).toEqual<ExecutionResult>({
        success: true,
        txHash: '0xTransactionHash',
      });

      // Verify wallet was retrieved
      expect(walletManager.getWallet).toHaveBeenCalledWith(walletType, 10);

      // Verify prover was retrieved and called
      expect(proverService.getProver).toHaveBeenCalledWith(1, mockIntent.reward.prover);
      expect(mockProver.getContractAddress).toHaveBeenCalledWith(10);
      expect(mockProver.getFee).toHaveBeenCalledWith(
        mockIntent,
        '0x0000000000000000000000001234567890123456789012345678901234567890',
      );
      expect(mockProver.generateProof).toHaveBeenCalledWith(mockIntent);

      // Verify transaction was sent
      expect(mockWallet.writeContracts).toHaveBeenCalled();
      const writeContractsCall = mockWallet.writeContracts.mock.calls[0];
      expect(writeContractsCall[0]).toHaveLength(2); // 1 approval + 1 fulfill

      // Verify transaction receipt was waited for
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: '0xTransactionHash',
      });
    });

    it('should handle intent without tokens', async () => {
      const intentWithoutTokens = {
        ...mockIntent,
        route: {
          ...mockIntent.route,
          tokens: [],
        },
      };

      const result = await service.fulfill(intentWithoutTokens, 'basic');

      expect(result.success).toBe(true);
      const writeContractsCall = mockWallet.writeContracts.mock.calls[0];
      expect(writeContractsCall[0]).toHaveLength(1); // Only fulfill tx, no approvals
    });

    it('should handle multiple tokens', async () => {
      const intentWithMultipleTokens = {
        ...mockIntent,
        route: {
          ...mockIntent.route,
          tokens: [
            {
              token: '0x0000000000000000000000002222222222222222222222222222222222222222' as any,
              amount: 100n,
            },
            {
              token: '0x0000000000000000000000003333333333333333333333333333333333333333' as any,
              amount: 200n,
            },
          ],
        },
      };

      const result = await service.fulfill(intentWithMultipleTokens, 'basic');

      expect(result.success).toBe(true);
      const writeContractsCall = mockWallet.writeContracts.mock.calls[0];
      expect(writeContractsCall[0]).toHaveLength(3); // 2 approvals + 1 fulfill
    });

    it('should handle missing prover', async () => {
      proverService.getProver.mockReturnValue(null);

      const result = await service.fulfill(mockIntent, 'basic');

      expect(result).toEqual<ExecutionResult>({
        success: false,
        error: 'Prover not found.',
      });
    });

    it('should handle wallet errors', async () => {
      mockWallet.writeContracts.mockRejectedValue(new Error('Wallet error'));

      const result = await service.fulfill(mockIntent, 'basic');

      expect(result).toEqual<ExecutionResult>({
        success: false,
        error: 'Wallet error',
      });
    });

    it('should handle transaction receipt errors', async () => {
      mockWallet.writeContracts.mockResolvedValue(['0xTransactionHash']);
      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(new Error('Receipt timeout'));

      const result = await service.fulfill(mockIntent, 'basic');

      expect(result).toEqual<ExecutionResult>({
        success: false,
        error: 'Receipt timeout',
      });
    });

    it('should use kernel wallet type', async () => {
      const walletType: WalletType = 'kernel';
      await service.fulfill(mockIntent, walletType);

      expect(walletManager.getWallet).toHaveBeenCalledWith(walletType, 10);
    });
  });

  describe('getBalance', () => {
    it('should get balance for address', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const chainId = 10;

      const balance = await service.getBalance(address, chainId);

      expect(balance).toBe(1000000000000000000n);
      expect(transportService.getPublicClient).toHaveBeenCalledWith(chainId);
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({ address });
    });
  });

  describe('getWalletAddress', () => {
    it('should get wallet address', async () => {
      const walletType: WalletType = 'basic';
      const chainId = 10;

      const address = await service.getWalletAddress(walletType, chainId);

      expect(address).toBe('0x0000000000000000000000001234567890123456789012345678901234567890');
      expect(walletManager.getWalletAddress).toHaveBeenCalledWith(walletType, chainId);
    });

    it('should handle bigint chainId', async () => {
      const walletType: WalletType = 'kernel';
      const chainId = 10n;

      const address = await service.getWalletAddress(walletType, chainId);

      expect(address).toBe('0x0000000000000000000000001234567890123456789012345678901234567890');
      expect(walletManager.getWalletAddress).toHaveBeenCalledWith(walletType, 10);
    });
  });

  describe('isTransactionConfirmed', () => {
    it('should return true for successful transaction', async () => {
      const txHash = '0xTransactionHash';
      const chainId = 10;

      const isConfirmed = await service.isTransactionConfirmed(txHash, chainId);

      expect(isConfirmed).toBe(true);
      expect(transportService.getPublicClient).toHaveBeenCalledWith(chainId);
      expect(mockPublicClient.getTransactionReceipt).toHaveBeenCalledWith({ hash: txHash });
    });

    it('should return false for failed transaction', async () => {
      mockPublicClient.getTransactionReceipt.mockResolvedValue({ status: 'reverted' });

      const isConfirmed = await service.isTransactionConfirmed('0xFailedTx', 10);

      expect(isConfirmed).toBe(false);
    });

    it('should return false when receipt not found', async () => {
      mockPublicClient.getTransactionReceipt.mockRejectedValue(new Error('Receipt not found'));

      const isConfirmed = await service.isTransactionConfirmed('0xUnknownTx', 10);

      expect(isConfirmed).toBe(false);
    });
  });
});
