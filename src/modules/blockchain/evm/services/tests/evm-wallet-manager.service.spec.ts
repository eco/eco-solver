import { Test, TestingModule } from '@nestjs/testing';

import { Address } from 'viem';

import { IEvmWallet } from '@/common/interfaces/evm-wallet.interface';
import { EvmConfigService } from '@/modules/config/services';

import { BasicWalletFactory } from '../../wallets/basic-wallet';
import { KernelWalletFactory } from '../../wallets/kernel-wallet';
import { EvmWalletManager, WalletType } from '../evm-wallet-manager.service';

describe('EvmWalletManager', () => {
  let service: EvmWalletManager;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let basicWalletFactory: jest.Mocked<BasicWalletFactory>;
  let kernelWalletFactory: jest.Mocked<KernelWalletFactory>;

  const mockBasicWallet: jest.Mocked<IEvmWallet> = {
    getAddress: jest.fn().mockResolvedValue('0xBasicWalletAddress' as Address),
    writeContract: jest.fn(),
    writeContracts: jest.fn(),
  };

  const mockKernelWallet: jest.Mocked<IEvmWallet> = {
    getAddress: jest.fn().mockResolvedValue('0xKernelWalletAddress' as Address),
    writeContract: jest.fn(),
    writeContracts: jest.fn(),
  };

  beforeEach(async () => {
    evmConfigService = {
      supportedChainIds: [1, 10, 137],
    } as any;

    basicWalletFactory = {
      name: 'basic' as WalletType,
      createWallet: jest.fn().mockResolvedValue(mockBasicWallet),
    } as any;

    kernelWalletFactory = {
      name: 'kernel' as WalletType,
      createWallet: jest.fn().mockResolvedValue(mockKernelWallet),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvmWalletManager,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: BasicWalletFactory, useValue: basicWalletFactory },
        { provide: KernelWalletFactory, useValue: kernelWalletFactory },
      ],
    }).compile();

    service = module.get<EvmWalletManager>(EvmWalletManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize wallets for all supported chains', async () => {
      await service.onModuleInit();

      // Should create wallets for each chain
      expect(basicWalletFactory.createWallet).toHaveBeenCalledTimes(3);
      expect(basicWalletFactory.createWallet).toHaveBeenCalledWith(1);
      expect(basicWalletFactory.createWallet).toHaveBeenCalledWith(10);
      expect(basicWalletFactory.createWallet).toHaveBeenCalledWith(137);

      expect(kernelWalletFactory.createWallet).toHaveBeenCalledTimes(3);
      expect(kernelWalletFactory.createWallet).toHaveBeenCalledWith(1);
      expect(kernelWalletFactory.createWallet).toHaveBeenCalledWith(10);
      expect(kernelWalletFactory.createWallet).toHaveBeenCalledWith(137);
    });

    it('should handle wallet initialization errors', async () => {
      const error = new Error('Failed to create wallet');
      basicWalletFactory.createWallet.mockRejectedValueOnce(error);

      await expect(service.onModuleInit()).rejects.toThrow(error);
    });

    it('should handle no supported chains', async () => {
      // Create a new service with empty supported chains
      const emptyConfigService = {
        supportedChainIds: [],
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EvmWalletManager,
          { provide: EvmConfigService, useValue: emptyConfigService },
          { provide: BasicWalletFactory, useValue: basicWalletFactory },
          { provide: KernelWalletFactory, useValue: kernelWalletFactory },
        ],
      }).compile();

      const newService = module.get<EvmWalletManager>(EvmWalletManager);
      await newService.onModuleInit();

      expect(basicWalletFactory.createWallet).not.toHaveBeenCalled();
      expect(kernelWalletFactory.createWallet).not.toHaveBeenCalled();
    });
  });

  describe('getWallet', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return basic wallet for chain', () => {
      const wallet = service.getWallet('basic', 1);

      expect(wallet).toBe(mockBasicWallet);
    });

    it('should return kernel wallet for chain', () => {
      const wallet = service.getWallet('kernel', 10);

      expect(wallet).toBe(mockKernelWallet);
    });

    it('should use default wallet type when not specified', () => {
      const wallet = service.getWallet(undefined, 137);

      expect(wallet).toBe(mockBasicWallet);
    });

    it('should throw error for unsupported chain', () => {
      expect(() => service.getWallet('basic', 999)).toThrow('No wallets configured for chain 999');
    });

    it('should throw error for unknown wallet type', () => {
      expect(() => service.getWallet('unknown' as WalletType, 1)).toThrow(
        "Wallet type 'unknown' not found for chain 1",
      );
    });
  });

  describe('getWalletAddress', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return basic wallet address', async () => {
      const address = await service.getWalletAddress('basic', 1);

      expect(address).toBe('0xBasicWalletAddress');
      expect(mockBasicWallet.getAddress).toHaveBeenCalled();
    });

    it('should return kernel wallet address', async () => {
      const address = await service.getWalletAddress('kernel', 10);

      expect(address).toBe('0xKernelWalletAddress');
      expect(mockKernelWallet.getAddress).toHaveBeenCalled();
    });

    it('should throw error for unsupported chain', async () => {
      await expect(service.getWalletAddress('basic', 999)).rejects.toThrow(
        'No wallets configured for chain 999',
      );
    });
  });

  describe('concurrent initialization', () => {
    it('should handle concurrent wallet initialization', async () => {
      // Simulate slow wallet creation
      basicWalletFactory.createWallet.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockBasicWallet), 100)),
      );
      kernelWalletFactory.createWallet.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockKernelWallet), 100)),
      );

      const start = Date.now();
      await service.onModuleInit();
      const duration = Date.now() - start;

      // Should complete in roughly 100ms, not 600ms (sequential)
      expect(duration).toBeLessThan(300);
      expect(basicWalletFactory.createWallet).toHaveBeenCalledTimes(3);
      expect(kernelWalletFactory.createWallet).toHaveBeenCalledTimes(3);
    });
  });

  describe('wallet factory names', () => {
    it('should use factory names as wallet types', async () => {
      await service.onModuleInit();

      // Verify wallets are stored with correct types
      const basicWallet = service.getWallet('basic', 1);
      const kernelWallet = service.getWallet('kernel', 1);

      expect(basicWallet).toBe(mockBasicWallet);
      expect(kernelWallet).toBe(mockKernelWallet);
    });
  });
});
