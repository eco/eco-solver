import { Test, TestingModule } from '@nestjs/testing';

import { Chain, Transport, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { EvmConfigService } from '@/modules/config/services';

import { EvmTransportService } from '../../../services/evm-transport.service';
import { BasicWalletFactory } from '../basic-wallet.factory';
import { BasicWallet } from '../basic-wallet';

jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(),
}));

jest.mock('../basic-wallet');

describe('BasicWalletFactory', () => {
  let factory: BasicWalletFactory;
  let evmConfigService: jest.Mocked<EvmConfigService>;
  let transportService: jest.Mocked<EvmTransportService>;

  const mockPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const mockAccount = {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
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
      getBasicWalletConfig: jest.fn().mockReturnValue({ privateKey: mockPrivateKey }),
    } as any;

    transportService = {
      getTransport: jest.fn().mockReturnValue(mockTransport),
      getViemChain: jest.fn().mockReturnValue(mockChain),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BasicWalletFactory,
        { provide: EvmConfigService, useValue: evmConfigService },
        { provide: EvmTransportService, useValue: transportService },
      ],
    }).compile();

    factory = module.get<BasicWalletFactory>(BasicWalletFactory);

    // Mock viem functions
    (privateKeyToAccount as jest.Mock).mockReturnValue(mockAccount);
    (createPublicClient as jest.Mock).mockReturnValue(mockPublicClient);
    (createWalletClient as jest.Mock).mockReturnValue(mockWalletClient);
    (BasicWallet as jest.Mock).mockImplementation((publicClient, walletClient) => ({
      publicClient,
      walletClient,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should have correct name', () => {
    expect(factory.name).toBe('basic');
  });

  describe('createWallet', () => {
    it('should create wallet for specified chain', async () => {
      const chainId = 1;
      const wallet = await factory.createWallet(chainId);

      // Verify configuration was retrieved
      expect(evmConfigService.getBasicWalletConfig).toHaveBeenCalled();

      // Verify transport and chain were retrieved
      expect(transportService.getTransport).toHaveBeenCalledWith(chainId);
      expect(transportService.getViemChain).toHaveBeenCalledWith(chainId);

      // Verify account was created from private key
      expect(privateKeyToAccount).toHaveBeenCalledWith(mockPrivateKey);

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

      // Verify BasicWallet was instantiated
      expect(BasicWallet).toHaveBeenCalledWith(mockPublicClient, mockWalletClient);
      expect(wallet).toBeDefined();
    });

    it('should handle different chain IDs', async () => {
      const chainId = 10;
      const optimismChain = { id: 10, name: 'Optimism' } as Chain;
      transportService.getViemChain.mockReturnValue(optimismChain);

      await factory.createWallet(chainId);

      expect(transportService.getTransport).toHaveBeenCalledWith(chainId);
      expect(transportService.getViemChain).toHaveBeenCalledWith(chainId);
      expect(createPublicClient).toHaveBeenCalledWith({
        chain: optimismChain,
        transport: mockTransport,
      });
    });

    it('should handle missing private key', async () => {
      evmConfigService.getBasicWalletConfig.mockReturnValue({ privateKey: undefined });

      await expect(factory.createWallet(1)).rejects.toThrow();
    });

    it('should handle transport service errors', async () => {
      const error = new Error('Transport not found');
      transportService.getTransport.mockImplementation(() => {
        throw error;
      });

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should handle account creation errors', async () => {
      const error = new Error('Invalid private key');
      (privateKeyToAccount as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(factory.createWallet(1)).rejects.toThrow(error);
    });

    it('should create different wallets for different chains', async () => {
      const wallet1 = await factory.createWallet(1);
      const wallet2 = await factory.createWallet(10);

      expect(BasicWallet).toHaveBeenCalledTimes(2);
      expect(wallet1).not.toBe(wallet2);
    });

    it('should use correct private key from config', async () => {
      const customPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      evmConfigService.getBasicWalletConfig.mockReturnValue({ privateKey: customPrivateKey });

      await factory.createWallet(1);

      expect(privateKeyToAccount).toHaveBeenCalledWith(customPrivateKey);
    });
  });
});