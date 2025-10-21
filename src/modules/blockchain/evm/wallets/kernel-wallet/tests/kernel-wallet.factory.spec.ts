import { Test, TestingModule } from '@nestjs/testing';

import { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { EvmConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

import { EvmTransportService } from '../../../services/evm-transport.service';
import { EvmWalletManager } from '../../../services/evm-wallet-manager.service';
import { KernelWallet } from '../kernel-wallet';
import { KernelWalletFactory } from '../kernel-wallet.factory';
import { kmsToAccount } from '../kms/kms-account';

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(),
}));

jest.mock('../kernel-wallet');
jest.mock('../kms/kms-account');

describe('KernelWalletFactory', () => {
  let factory: KernelWalletFactory;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;
  let mockEvmWalletManager: any;
  let mockLogger: any;
  let mockOtelService: any;

  const mockEoaPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const mockAccount = {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  };
  const mockKmsAccount = {
    address: '0xKmsAccountAddress' as Address,
  };

  beforeEach(async () => {
    evmConfigService = {
      getKernelWalletConfig: jest.fn().mockReturnValue({
        signer: {
          type: 'eoa' as const,
          privateKey: mockEoaPrivateKey,
        },
      }),
      getChain: jest.fn(),
    } as any;

    transportService = {
      getTransport: jest.fn(),
      getViemChain: jest.fn(),
      getPublicClient: jest.fn(),
    } as any;

    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    mockOtelService = {
      tracer: {
        startActiveSpan: jest.fn().mockImplementation((name, options, fn) => {
          const span = {
            setAttribute: jest.fn(),
            setAttributes: jest.fn(),
            setStatus: jest.fn(),
            recordException: jest.fn(),
            end: jest.fn(),
          };
          return fn(span);
        }),
      },
    };

    mockEvmWalletManager = {
      getWallet: jest.fn(),
      getWalletAddress: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KernelWalletFactory,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: EvmTransportService, useValue: transportService },
        { provide: SystemLoggerService, useValue: mockLogger },
        { provide: OpenTelemetryService, useValue: mockOtelService },
        { provide: EvmWalletManager, useValue: mockEvmWalletManager },
      ],
    }).compile();

    factory = module.get<KernelWalletFactory>(KernelWalletFactory);

    // Mock viem functions
    (privateKeyToAccount as jest.Mock).mockReturnValue(mockAccount);
    (kmsToAccount as jest.Mock).mockResolvedValue(mockKmsAccount);

    // Mock KernelWallet
    const mockKernelWalletInstance = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    (KernelWallet as jest.Mock).mockImplementation(() => mockKernelWalletInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton promise if factory is defined
    if (factory) {
      (factory as any).signerPromise = null;
    }

    // Reset KernelWallet mock to default behavior
    const mockKernelWalletInstance = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    (KernelWallet as jest.Mock).mockImplementation(() => mockKernelWalletInstance);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should have correct name', () => {
    expect(factory.name).toBe('kernel');
  });

  describe('createWallet with EOA signer', () => {
    beforeEach(() => {
      const kernelConfig = {
        signer: {
          type: 'eoa' as const,
          privateKey: mockEoaPrivateKey,
        },
      };
      evmConfigService.getKernelWalletConfig.mockReturnValue(kernelConfig);
    });

    it('should create wallet with EOA signer', async () => {
      const chainId = 1;
      const mockNetworkConfig = {
        chainId,
        rpc: {
          urls: ['http://localhost:8545'],
          options: {
            batch: true,
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          },
        },
        contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
        tokens: [],
        fee: { tokens: { flatFee: 0, scalarBps: 0 } },
        provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
        defaultProver: 'hyper' as const,
        claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
      };
      evmConfigService.getChain.mockReturnValue(mockNetworkConfig);

      const wallet = await factory.createWallet(chainId);

      // Verify configuration was retrieved
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalled();
      expect(evmConfigService.getChain).toHaveBeenCalledWith(chainId);

      // Verify EOA account was created
      expect(privateKeyToAccount).toHaveBeenCalledWith(mockEoaPrivateKey);

      // Verify KernelWallet was created with correct parameters
      expect(KernelWallet).toHaveBeenCalledWith(
        chainId,
        mockAccount,
        evmConfigService.getKernelWalletConfig(),
        mockNetworkConfig,
        transportService,
        mockLogger,
        mockOtelService,
        mockEvmWalletManager,
      );
      expect(wallet).toBeDefined();

      // Verify init was called by checking the mock
      const mockCalls = (KernelWallet as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const mockInstance = (KernelWallet as jest.Mock).mock.results[0].value;
      expect(mockInstance.init).toHaveBeenCalled();
    });

    it('should reuse signer for multiple wallets', async () => {
      const mockNetworkConfig1 = {
        chainId: 1,
        rpc: {
          urls: ['http://localhost:8545'],
          options: {
            batch: true,
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          },
        },
        contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
        tokens: [],
        fee: { tokens: { flatFee: 0, scalarBps: 0 } },
        provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
        defaultProver: 'hyper' as const,
        claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
      };
      const mockNetworkConfig10 = { ...mockNetworkConfig1, chainId: 10 };

      evmConfigService.getChain.mockImplementation((chainId: number) => {
        return chainId === 1 ? mockNetworkConfig1 : mockNetworkConfig10;
      });

      await factory.createWallet(1);
      await factory.createWallet(10);

      // Signer should only be created once
      expect(privateKeyToAccount).toHaveBeenCalledTimes(1);

      // Config is only called once in constructor for kernel wallet config
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalledTimes(1);

      // But wallet instances should be different
      expect(KernelWallet).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent wallet creation', async () => {
      const mockNetworkConfigs: Record<number, any> = {
        1: {
          chainId: 1,
          rpc: {
            urls: ['http://localhost:8545'],
            options: {
              batch: true,
              timeout: 10000,
              retryCount: 3,
              retryDelay: 1000,
            },
          },
          contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
          tokens: [],
          fee: { tokens: { flatFee: 0, scalarBps: 0 } },
          provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
          defaultProver: 'hyper' as const,
          claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
        },
        10: {
          chainId: 10,
          rpc: {
            urls: ['http://localhost:8545'],
            options: {
              batch: true,
              timeout: 10000,
              retryCount: 3,
              retryDelay: 1000,
            },
          },
          contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
          tokens: [],
          fee: { tokens: { flatFee: 0, scalarBps: 0 } },
          provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
          defaultProver: 'hyper' as const,
          claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
        },
        137: {
          chainId: 137,
          rpc: {
            urls: ['http://localhost:8545'],
            options: {
              batch: true,
              timeout: 10000,
              retryCount: 3,
              retryDelay: 1000,
            },
          },
          contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
          tokens: [],
          fee: { tokens: { flatFee: 0, scalarBps: 0 } },
          provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
          defaultProver: 'hyper' as const,
          claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
        },
      };

      evmConfigService.getChain.mockImplementation(
        (chainId: number) => mockNetworkConfigs[chainId],
      );

      // Create multiple wallets concurrently
      const promises = [
        factory.createWallet(1),
        factory.createWallet(10),
        factory.createWallet(137),
      ];

      const wallets = await Promise.all(promises);

      // Signer should only be created once
      expect(privateKeyToAccount).toHaveBeenCalledTimes(1);

      // All wallets should be created
      expect(wallets).toHaveLength(3);
      expect(KernelWallet).toHaveBeenCalledTimes(3);
    });
  });

  describe('createWallet with KMS signer', () => {
    const mockKmsConfig = {
      region: 'us-east-1',
      keyID: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
    };

    let kmsFactory: KernelWalletFactory;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          KernelWalletFactory,
          {
            provide: EvmConfigService,
            useValue: {
              ...evmConfigService,
              getKernelWalletConfig: jest.fn().mockReturnValue({
                signer: {
                  type: 'kms' as const,
                  ...mockKmsConfig,
                },
              }),
            },
          },
          { provide: EvmTransportService, useValue: transportService },
          { provide: SystemLoggerService, useValue: mockLogger },
          { provide: OpenTelemetryService, useValue: mockOtelService },
          { provide: EvmWalletManager, useValue: mockEvmWalletManager },
        ],
      }).compile();

      kmsFactory = module.get<KernelWalletFactory>(KernelWalletFactory);
    });

    it('should create wallet with KMS signer', async () => {
      const chainId = 1;
      const mockNetworkConfig = {
        chainId,
        rpc: {
          urls: ['http://localhost:8545'],
          options: {
            batch: true,
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          },
        },
        contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
        tokens: [],
        fee: { tokens: { flatFee: 0, scalarBps: 0 } },
        provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
        defaultProver: 'hyper' as const,
        claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
      };
      evmConfigService.getChain.mockReturnValue(mockNetworkConfig);

      const wallet = await kmsFactory.createWallet(chainId);

      // Verify KMS account was created
      expect(kmsToAccount).toHaveBeenCalledWith({
        type: 'kms',
        keyID: mockKmsConfig.keyID,
        region: mockKmsConfig.region,
      });

      // Verify KernelWallet was created with KMS account
      expect(KernelWallet).toHaveBeenCalledWith(
        chainId,
        mockKmsAccount,
        expect.objectContaining({
          signer: expect.objectContaining({
            type: 'kms',
            keyID: mockKmsConfig.keyID,
            region: mockKmsConfig.region,
          }),
        }),
        mockNetworkConfig,
        transportService,
        mockLogger,
        mockOtelService,
        expect.any(Object), // EvmWalletManager
      );

      expect(wallet).toBeDefined();

      // Verify init was called by checking the mock
      const mockCalls = (KernelWallet as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const mockInstance = (KernelWallet as jest.Mock).mock.results[mockCalls.length - 1].value;
      expect(mockInstance.init).toHaveBeenCalled();
    });

    it('should pass additional KMS options', async () => {
      const kmsConfigWithOptions = {
        ...mockKmsConfig,
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      };

      // Create a separate factory for this test with different config
      const module = await Test.createTestingModule({
        providers: [
          KernelWalletFactory,
          {
            provide: EvmConfigService,
            useValue: {
              ...evmConfigService,
              getKernelWalletConfig: jest.fn().mockReturnValue({
                signer: {
                  type: 'kms' as const,
                  ...kmsConfigWithOptions,
                },
              }),
            },
          },
          { provide: EvmTransportService, useValue: transportService },
          { provide: SystemLoggerService, useValue: mockLogger },
          { provide: OpenTelemetryService, useValue: mockOtelService },
          { provide: EvmWalletManager, useValue: mockEvmWalletManager },
        ],
      }).compile();

      const testFactory = module.get<KernelWalletFactory>(KernelWalletFactory);

      const mockNetworkConfig = {
        chainId: 1,
        rpc: {
          urls: ['http://localhost:8545'],
          options: {
            batch: true,
            timeout: 10000,
            retryCount: 3,
            retryDelay: 1000,
          },
        },
        contracts: { portal: '0x0000000000000000000000000000000000000001' as `0x${string}` },
        tokens: [],
        fee: { tokens: { flatFee: 0, scalarBps: 0 } },
        provers: { hyper: '0x0000000000000000000000000000000000000002' as `0x${string}` },
        defaultProver: 'hyper' as const,
        claimant: '0x0000000000000000000000000000000000000003' as `0x${string}`,
      };
      evmConfigService.getChain.mockReturnValue(mockNetworkConfig);

      await testFactory.createWallet(1);

      expect(kmsToAccount).toHaveBeenCalledWith({
        type: 'kms',
        keyID: kmsConfigWithOptions.keyID,
        region: kmsConfigWithOptions.region,
        credentials: kmsConfigWithOptions.credentials,
      });
    });
  });

  describe('error handling', () => {
    it('should handle unsupported signer type', async () => {
      // Mock the mocked viem function to return an account
      (privateKeyToAccount as jest.Mock).mockReturnValue(mockAccount);

      // Create a new factory instance with unsupported config
      const module = await Test.createTestingModule({
        providers: [
          KernelWalletFactory,
          {
            provide: EvmConfigService,
            useValue: {
              ...evmConfigService,
              getKernelWalletConfig: jest.fn().mockReturnValue({
                signer: {
                  type: 'unsupported' as any,
                  privateKey: mockEoaPrivateKey,
                } as any,
              }),
            },
          },
          { provide: EvmTransportService, useValue: transportService },
          { provide: SystemLoggerService, useValue: mockLogger },
          { provide: OpenTelemetryService, useValue: mockOtelService },
          { provide: EvmWalletManager, useValue: mockEvmWalletManager },
        ],
      }).compile();

      const testFactory = module.get<KernelWalletFactory>(KernelWalletFactory);

      await expect(testFactory.createWallet(1)).rejects.toThrow(
        'Unsupported signer type: unsupported',
      );
    });

    it('should handle missing signer configuration', async () => {
      // Create a new factory instance with missing config
      const createModule = async () => {
        const module = await Test.createTestingModule({
          providers: [
            KernelWalletFactory,
            {
              provide: EvmConfigService,
              useValue: {
                ...evmConfigService,
                getKernelWalletConfig: jest.fn().mockReturnValue(null),
              },
            },
            { provide: EvmTransportService, useValue: transportService },
            { provide: SystemLoggerService, useValue: mockLogger },
            { provide: OpenTelemetryService, useValue: mockOtelService },
            { provide: EvmWalletManager, useValue: mockEvmWalletManager },
          ],
        }).compile();

        return module.get<KernelWalletFactory>(KernelWalletFactory);
      };

      await expect(createModule()).rejects.toThrow('Kernel config required');
    });

    it('should handle transport service errors', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa' as const,
          privateKey: mockEoaPrivateKey,
        },
      });

      const error = new Error('Transport not found');

      // Mock KernelWallet to throw error during construction
      (KernelWallet as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle wallet initialization errors', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa' as const,
          privateKey: mockEoaPrivateKey,
        },
      });

      const error = new Error('Failed to initialize wallet');
      (KernelWallet as jest.Mock).mockImplementationOnce(() => ({
        init: jest.fn().mockRejectedValue(error),
      }));

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle EOA account creation errors', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa' as const,
          privateKey: mockEoaPrivateKey,
        },
      });

      const error = new Error('Invalid private key');
      (privateKeyToAccount as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle KMS account creation errors', async () => {
      // Create a new factory instance with KMS config
      const module = await Test.createTestingModule({
        providers: [
          KernelWalletFactory,
          {
            provide: EvmConfigService,
            useValue: {
              ...evmConfigService,
              getKernelWalletConfig: jest.fn().mockReturnValue({
                signer: {
                  type: 'kms' as const,
                  keyID:
                    'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
                  region: 'us-east-1',
                },
              }),
            },
          },
          { provide: EvmTransportService, useValue: transportService },
          { provide: SystemLoggerService, useValue: mockLogger },
          { provide: OpenTelemetryService, useValue: mockOtelService },
          { provide: EvmWalletManager, useValue: mockEvmWalletManager },
        ],
      }).compile();

      const testFactory = module.get<KernelWalletFactory>(KernelWalletFactory);

      const error = new Error('KMS key not found');
      (kmsToAccount as jest.Mock).mockRejectedValue(error);

      await expect(testFactory.createWallet(1)).rejects.toThrow(error);
    });
  });
});
