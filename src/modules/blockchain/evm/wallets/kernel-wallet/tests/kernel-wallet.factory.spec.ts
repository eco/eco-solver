import { Test, TestingModule } from '@nestjs/testing';

import { Address, Chain, createPublicClient, createWalletClient, Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../../services/evm-transport.service';
import { KernelWallet } from '../kernel-wallet';
import { KernelWalletFactory } from '../kernel-wallet.factory';
import { kmsToAccount } from '../kms/kms-account';

jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(),
}));

jest.mock('../kernel-wallet');
jest.mock('../kms/kms-account');

describe('KernelWalletFactory', () => {
  let factory: KernelWalletFactory;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;

  const mockEoaPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const mockAccount = {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  };
  const mockKmsAccount = {
    address: '0xKmsAccountAddress' as Address,
  };
  const mockTransport = {} as Transport;
  const mockChain: Chain = {
    id: 1,
    name: 'Ethereum',
  } as Chain;
  const mockPublicClient = { id: 'publicClient' };
  const mockWalletClient = { id: 'walletClient' };

  beforeEach(async () => {
    evmConfigService = {
      getKernelWalletConfig: jest.fn(),
    } as any;

    transportService = {
      getTransport: jest.fn().mockReturnValue(mockTransport),
      getViemChain: jest.fn().mockReturnValue(mockChain),
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KernelWalletFactory,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: EvmTransportService, useValue: transportService },
      ],
    }).compile();

    factory = module.get<KernelWalletFactory>(KernelWalletFactory);

    // Mock viem functions
    (privateKeyToAccount as jest.Mock).mockReturnValue(mockAccount);
    (kmsToAccount as jest.Mock).mockResolvedValue(mockKmsAccount);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
    
    // Mock KernelWallet
    const mockKernelWalletInstance = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    (KernelWallet as jest.Mock).mockImplementation(() => mockKernelWalletInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton promise
    (factory as any).signerPromise = null;
    
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
      const wallet = await factory.createWallet(chainId);

      // Verify configuration was retrieved
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalled();

      // Verify EOA account was created
      expect(privateKeyToAccount).toHaveBeenCalledWith(mockEoaPrivateKey);

      // Verify KernelWallet was created with correct parameters
      expect(KernelWallet).toHaveBeenCalledWith(
        chainId,
        mockAccount,
        evmConfigService.getKernelWalletConfig(),
        transportService,
      );
      expect(wallet).toBeDefined();
      
      // Verify init was called by checking the mock
      const mockCalls = (KernelWallet as jest.Mock).mock.calls;
      expect(mockCalls.length).toBeGreaterThan(0);
      const mockInstance = (KernelWallet as jest.Mock).mock.results[0].value;
      expect(mockInstance.init).toHaveBeenCalled();
    });

    it('should reuse signer for multiple wallets', async () => {
      await factory.createWallet(1);
      await factory.createWallet(10);

      // Signer should only be created once
      expect(privateKeyToAccount).toHaveBeenCalledTimes(1);
      
      // Config is called once for signer creation and once per wallet instance
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalledTimes(3); // 1 for signer + 2 for wallets

      // But wallet instances should be different
      expect(KernelWallet).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent wallet creation', async () => {
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

    beforeEach(() => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'kms' as const,
          ...mockKmsConfig,
        },
      });
    });

    it('should create wallet with KMS signer', async () => {
      const chainId = 1;
      const wallet = await factory.createWallet(chainId);

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
        evmConfigService.getKernelWalletConfig(),
        transportService,
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
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'kms' as const,
          ...kmsConfigWithOptions,
        },
      });

      await factory.createWallet(1);

      expect(kmsToAccount).toHaveBeenCalledWith({
        type: 'kms',
        ...kmsConfigWithOptions,
      });
    });
  });

  describe('error handling', () => {
    it('should handle unsupported signer type', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'unsupported' as any,
        },
      });

      await expect(factory.createWallet(1)).rejects.toThrow('Unsupported signer type: unsupported');
    });

    it('should handle missing signer configuration', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: undefined as any,
      });

      await expect(factory.createWallet(1)).rejects.toThrow();
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
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'kms' as const,
          region: 'us-east-1',
        },
      });

      const error = new Error('KMS key not found');
      (kmsToAccount as jest.Mock).mockRejectedValue(error);

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });
  });
});
