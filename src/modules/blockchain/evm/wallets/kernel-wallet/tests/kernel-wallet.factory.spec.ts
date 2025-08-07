import { Test, TestingModule } from '@nestjs/testing';

import { Chain, Transport, createPublicClient, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../../services/evm-transport.service';
import { KernelWalletFactory } from '../kernel-wallet.factory';
import { KernelWallet } from '../kernel-wallet';
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
  const mockKernelWallet = {
    init: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    evmConfigService = {
      getKernelWalletConfig: jest.fn(),
    } as any;

    transportService = {
      getTransport: jest.fn().mockReturnValue(mockTransport),
      getViemChain: jest.fn().mockReturnValue(mockChain),
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
    (KernelWallet as jest.Mock).mockReturnValue(mockKernelWallet);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset singleton promise
    (factory as any).signerPromise = null;
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should have correct name', () => {
    expect(factory.name).toBe('kernel');
  });

  describe('createWallet with EOA signer', () => {
    beforeEach(() => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa',
          privateKey: mockEoaPrivateKey,
        },
      });
    });

    it('should create wallet with EOA signer', async () => {
      const chainId = 1;
      const wallet = await factory.createWallet(chainId);

      // Verify configuration was retrieved
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalled();

      // Verify transport and chain were retrieved
      expect(transportService.getTransport).toHaveBeenCalledWith(chainId);
      expect(transportService.getViemChain).toHaveBeenCalledWith(chainId);

      // Verify EOA account was created
      expect(privateKeyToAccount).toHaveBeenCalledWith(mockEoaPrivateKey);

      // Verify clients were created
      expect(createPublicClient).toHaveBeenCalledWith({
        chain: mockChain,
        transport: mockTransport,
      });

      expect(createWalletClient).toHaveBeenCalledWith({
        account: mockAccount,
        chain: mockChain,
        transport: mockTransport,
      });

      // Verify KernelWallet was created and initialized
      expect(KernelWallet).toHaveBeenCalledWith(mockPublicClient, mockWalletClient);
      expect(mockKernelWallet.init).toHaveBeenCalled();
      expect(wallet).toBe(mockKernelWallet);
    });

    it('should reuse signer for multiple wallets', async () => {
      await factory.createWallet(1);
      await factory.createWallet(10);

      // Signer should only be created once
      expect(privateKeyToAccount).toHaveBeenCalledTimes(1);
      expect(evmConfigService.getKernelWalletConfig).toHaveBeenCalledTimes(1);

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
      keyId: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
    };

    beforeEach(() => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'kms',
          ...mockKmsConfig,
        },
      });
    });

    it('should create wallet with KMS signer', async () => {
      const chainId = 1;
      const wallet = await factory.createWallet(chainId);

      // Verify KMS account was created
      expect(kmsToAccount).toHaveBeenCalledWith({
        keyId: mockKmsConfig.keyId,
        region: mockKmsConfig.region,
      });

      // Verify wallet client was created with KMS account
      expect(createWalletClient).toHaveBeenCalledWith({
        account: mockKmsAccount,
        chain: mockChain,
        transport: mockTransport,
      });

      expect(wallet).toBe(mockKernelWallet);
    });

    it('should pass additional KMS options', async () => {
      const kmsConfigWithOptions = {
        ...mockKmsConfig,
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };

      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'kms',
          ...kmsConfigWithOptions,
        },
      });

      await factory.createWallet(1);

      expect(kmsToAccount).toHaveBeenCalledWith(kmsConfigWithOptions);
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
          type: 'eoa',
          privateKey: mockEoaPrivateKey,
        },
      });

      const error = new Error('Transport not found');
      transportService.getTransport.mockImplementation(() => {
        throw error;
      });

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle wallet initialization errors', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa',
          privateKey: mockEoaPrivateKey,
        },
      });

      const error = new Error('Failed to initialize wallet');
      mockKernelWallet.init.mockRejectedValue(error);

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle EOA account creation errors', async () => {
      evmConfigService.getKernelWalletConfig.mockReturnValue({
        signer: {
          type: 'eoa',
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
          type: 'kms',
          region: 'us-east-1',
          keyId: 'test-key-id',
        },
      });

      const error = new Error('KMS key not found');
      (kmsToAccount as jest.Mock).mockRejectedValue(error);

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });
  });
});