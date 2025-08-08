import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { Address, createWalletClient, encodeFunctionData, Hex, LocalAccount } from 'viem';

import { Call } from '@/common/interfaces/evm-wallet.interface';
import { KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

import { KernelWallet } from '../kernel-wallet';
import { encodeKernelExecuteCallData } from '../utils/encode-transactions';

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeFunctionData: jest.fn(),
  createWalletClient: jest.fn(),
}));

jest.mock('@zerodev/sdk', () => ({
  createKernelAccount: jest.fn(),
}));

// Import mocked values from jest.setup.ts
import { getEntryPoint } from '@zerodev/sdk/constants';

jest.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: jest.fn(),
}));

jest.mock('../utils/encode-transactions', () => ({
  encodeKernelExecuteCallData: jest.fn(),
}));

describe('KernelWallet', () => {
  let wallet: KernelWallet;
  let mockTransportService: jest.Mocked<EvmTransportService>;
  let mockSigner: jest.Mocked<LocalAccount>;
  let mockKernelWalletConfig: KernelWalletConfig;
  let mockPublicClient: any;
  let mockSignerWalletClient: any;
  let mockKernelAccount: any;

  const mockChainId = 1;
  const mockAddress = '0xKernelAccountAddress' as Address;
  const mockTxHash = '0xTransactionHash' as Hex;

  beforeEach(() => {
    // Mock public client
    mockPublicClient = {
      getCode: jest.fn().mockResolvedValue('0x'),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
    } as any;

    // Mock signer wallet client
    mockSignerWalletClient = {
      sendTransaction: jest.fn().mockResolvedValue(mockTxHash),
    } as any;

    // Mock signer
    mockSigner = {
      address: '0xSignerAddress' as Address,
      signMessage: jest.fn(),
      signTransaction: jest.fn(),
      signTypedData: jest.fn(),
    } as any;

    // Mock transport service
    mockTransportService = {
      getPublicClient: jest.fn().mockReturnValue(mockPublicClient),
      getTransport: jest.fn().mockReturnValue('http'),
      getViemChain: jest.fn().mockReturnValue({ id: 1, name: 'mainnet' }),
    } as any;

    // Mock kernel wallet config
    mockKernelWalletConfig = {
      signer: {
        type: 'eoa',
        privateKey: '0xPrivateKey',
      },
    } as any;

    // Mock kernel account
    mockKernelAccount = {
      address: mockAddress,
      isDeployed: jest.fn().mockResolvedValue(true),
      getFactoryArgs: jest.fn().mockResolvedValue({
        factory: '0xFactoryAddress',
        factoryData: '0xFactoryData',
      }),
    };

    // Mock validator
    const mockValidator = { type: 'ecdsa' };
    (signerToEcdsaValidator as jest.Mock).mockResolvedValue(mockValidator);

    // Mock kernel account creation
    (createKernelAccount as jest.Mock).mockResolvedValue(mockKernelAccount);

    // Mock encodeFunctionData
    (encodeFunctionData as jest.Mock).mockReturnValue('0xEncodedData');

    // Mock createWalletClient from viem
    (createWalletClient as jest.Mock).mockReturnValue(mockSignerWalletClient);

    // Create wallet instance
    wallet = new KernelWallet(
      mockChainId,
      mockSigner,
      mockKernelWalletConfig,
      mockTransportService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize kernel account', async () => {
      await wallet.init();

      // Verify validator creation
      const mockEntryPoint = (getEntryPoint as jest.Mock)();
      expect(signerToEcdsaValidator).toHaveBeenCalledWith(
        mockPublicClient,
        expect.objectContaining({
          signer: mockSigner,
          entryPoint: mockEntryPoint,
          kernelVersion: KERNEL_V3_1,
        }),
      );

      // Verify kernel account creation
      expect(createKernelAccount).toHaveBeenCalledWith(
        mockPublicClient,
        expect.objectContaining({
          entryPoint: mockEntryPoint,
          kernelVersion: KERNEL_V3_1,
          useMetaFactory: false,
          plugins: {
            sudo: { type: 'ecdsa' },
          },
        }),
      );

      // Verify deployment check
      expect(mockKernelAccount.isDeployed).toHaveBeenCalled();
    });

    it('should deploy account if not deployed', async () => {
      // Mock account not deployed
      mockKernelAccount.isDeployed.mockResolvedValue(false);

      await wallet.init();

      // Verify deployment check
      expect(mockKernelAccount.isDeployed).toHaveBeenCalled();

      // Verify deployment
      expect(mockKernelAccount.getFactoryArgs).toHaveBeenCalled();
      expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '0xFactoryAddress',
          data: '0xFactoryData',
        }),
      );
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash,
      });
    });

    it('should not deploy if account already deployed', async () => {
      // Mock account deployed
      mockKernelAccount.isDeployed.mockResolvedValue(true);

      await wallet.init();

      expect(mockKernelAccount.getFactoryArgs).not.toHaveBeenCalled();
      expect(mockSignerWalletClient.sendTransaction).not.toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await wallet.init();
      await wallet.init();

      // Should only create account once
      expect(createKernelAccount).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Failed to create kernel account');
      (createKernelAccount as jest.Mock).mockRejectedValue(error);

      await expect(wallet.init()).rejects.toThrow(error);
    });
  });

  describe('getAddress', () => {
    it('should return kernel account address after init', async () => {
      await wallet.init();
      const address = await wallet.getAddress();

      expect(address).toBe(mockAddress);
    });

    it('should return kernel account address if initialized', async () => {
      await wallet.init();
      const address = await wallet.getAddress();
      expect(address).toBe(mockAddress);
    });
  });

  describe('writeContract', () => {
    const mockParams: Call = {
      to: '0xContractAddress' as Address,
      data: '0xtransfer' as Hex,
      value: 0n,
    };

    it('should execute single contract write', async () => {
      await wallet.init();
      const result = await wallet.writeContract(mockParams);

      expect(result).toBe(mockTxHash);

      // Should use writeContracts internally
      expect(encodeKernelExecuteCallData).toHaveBeenCalledWith([mockParams]);
    });

    beforeEach(async () => {
      await wallet.init();
    });
  });

  describe('writeContracts', () => {
    const mockParams: Call[] = [
      {
        to: '0xToken1' as Address,
        data: '0xapprove1' as Hex,
        value: 0n,
      },
      {
        to: '0xToken2' as Address,
        data: '0xapprove2' as Hex,
        value: 1000000000000000000n,
      },
    ];

    beforeEach(async () => {
      await wallet.init();
      (encodeKernelExecuteCallData as jest.Mock).mockReturnValue('0xBatchEncodedData');
    });

    it('should execute batch contract writes', async () => {
      const result = await wallet.writeContracts(mockParams);

      expect(result).toEqual([mockTxHash]);

      // Verify encoding
      expect(encodeKernelExecuteCallData).toHaveBeenCalledWith(mockParams);

      // Verify transaction sent with signer wallet client
      expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAddress,
          data: '0xBatchEncodedData',
          value: 1000000000000000000n, // Total value
        }),
      );
    });

    it('should handle writeContracts options with value', async () => {
      const options = { value: 2000000000000000000n };
      await wallet.writeContracts(mockParams, options);

      expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAddress,
          data: '0xBatchEncodedData',
          value: 2000000000000000000n, // Options value overrides
        }),
      );
    });

    it('should calculate total value from calls', async () => {
      const paramsWithValues: Call[] = [
        {
          to: '0xContract1' as Address,
          data: '0xdeposit1' as Hex,
          value: 1000000000000000000n,
        },
        {
          to: '0xContract2' as Address,
          data: '0xdeposit2' as Hex,
          value: 2000000000000000000n,
        },
      ];

      await wallet.writeContracts(paramsWithValues);

      expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAddress,
          data: '0xBatchEncodedData',
          value: 3000000000000000000n, // Sum of values
        }),
      );
    });

    it('should handle empty params', async () => {
      const result = await wallet.writeContracts([]);

      expect(result).toEqual([mockTxHash]);

      expect(encodeKernelExecuteCallData).toHaveBeenCalledWith([]);
    });

    it('should ignore keepSender option', async () => {
      // Kernel wallet always keeps sender (smart account)
      const result = await wallet.writeContracts(mockParams, { keepSender: false });

      expect(result).toEqual([mockTxHash]);
      // Should still use kernel encoding, not multicall
    });

    it('should throw error when account deployment fails', async () => {
      // Create new wallet instance for deployment failure test
      const newWallet = new KernelWallet(
        mockChainId,
        mockSigner,
        mockKernelWalletConfig,
        mockTransportService,
      );

      // Mock deployment failure
      mockKernelAccount.isDeployed.mockResolvedValue(false);
      mockKernelAccount.getFactoryArgs.mockResolvedValue({ factory: null, factoryData: null });

      await expect(newWallet.init()).rejects.toThrow('Unable to deploy kernel account');
    });
  });
});
