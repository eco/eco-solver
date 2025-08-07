import { PublicClient, WalletClient, Address, Hex, encodeFunctionData } from 'viem';
import { KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';

import { Call } from '@/common/interfaces/evm-wallet.interface';
import { KernelWallet } from '../kernel-wallet';

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeFunctionData: jest.fn(),
}));

jest.mock('@zerodev/sdk', () => ({
  createKernelAccount: jest.fn(),
  createKernelAccountClient: jest.fn(),
}));

jest.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: jest.fn(),
}));

jest.mock('../utils/encode-transactions', () => ({
  encodeCallDataForKernel: jest.fn(),
}));

describe('KernelWallet', () => {
  let wallet: KernelWallet;
  let mockPublicClient: jest.Mocked<PublicClient>;
  let mockSignerWalletClient: jest.Mocked<WalletClient>;
  let mockKernelAccount: any;
  let mockKernelClient: any;

  const mockAddress = '0xKernelAccountAddress' as Address;
  const mockTxHash = '0xTransactionHash' as Hex;
  const mockDeployTxHash = '0xDeployTxHash' as Hex;

  beforeEach(() => {
    // Mock public client
    mockPublicClient = {
      getCode: jest.fn().mockResolvedValue('0x'),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
    } as any;

    // Mock signer wallet client
    mockSignerWalletClient = {
      sendTransaction: jest.fn().mockResolvedValue(mockDeployTxHash),
    } as any;

    // Mock kernel account
    mockKernelAccount = {
      address: mockAddress,
      getFactoryArgs: jest.fn().mockResolvedValue({
        factory: '0xFactoryAddress',
        factoryData: '0xFactoryData',
      }),
    };

    // Mock kernel client
    mockKernelClient = {
      sendTransaction: jest.fn().mockResolvedValue(mockTxHash),
    };

    // Mock validator
    const mockValidator = { type: 'ecdsa' };
    (signerToEcdsaValidator as jest.Mock).mockResolvedValue(mockValidator);

    // Mock kernel account creation
    (createKernelAccount as jest.Mock).mockResolvedValue(mockKernelAccount);
    (createKernelAccountClient as jest.Mock).mockResolvedValue(mockKernelClient);

    // Mock encodeFunctionData
    (encodeFunctionData as jest.Mock).mockReturnValue('0xEncodedData');

    // Create wallet instance
    wallet = new KernelWallet(mockPublicClient, mockSignerWalletClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize kernel account', async () => {
      await wallet.init();

      // Verify validator creation
      expect(signerToEcdsaValidator).toHaveBeenCalledWith(mockPublicClient, {
        signer: mockSignerWalletClient,
        entryPoint: KERNEL_V3_1.entryPoint,
        kernelVersion: KERNEL_V3_1.kernelVersion,
      });

      // Verify kernel account creation
      expect(createKernelAccount).toHaveBeenCalledWith(mockPublicClient, {
        entryPoint: KERNEL_V3_1.entryPoint,
        kernelVersion: KERNEL_V3_1.kernelVersion,
        plugins: {
          sudo: { type: 'ecdsa' },
        },
      });

      // Verify kernel client creation
      expect(createKernelAccountClient).toHaveBeenCalledWith({
        account: mockKernelAccount,
        entryPoint: KERNEL_V3_1.entryPoint,
        bundlerTransport: expect.any(Function),
      });
    });

    it('should deploy account if not deployed', async () => {
      // Mock account not deployed (no code)
      mockPublicClient.getCode.mockResolvedValue(undefined);

      await wallet.init();

      // Verify deployment check
      expect(mockPublicClient.getCode).toHaveBeenCalledWith({ address: mockAddress });

      // Verify deployment
      expect(mockKernelAccount.getFactoryArgs).toHaveBeenCalled();
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: expect.any(Array),
        functionName: 'createAccount',
        args: ['0xFactoryData', 0n],
      });
      expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith({
        to: '0xFactoryAddress',
        data: '0xEncodedData',
      });
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockDeployTxHash,
      });
    });

    it('should not deploy if account already deployed', async () => {
      // Mock account deployed (has code)
      mockPublicClient.getCode.mockResolvedValue('0x123456');

      await wallet.init();

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

    it('should throw error if not initialized', async () => {
      await expect(wallet.getAddress()).rejects.toThrow('Kernel account not initialized');
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
      const { encodeCallDataForKernel } = require('../utils/encode-transactions');
      expect(encodeCallDataForKernel).toHaveBeenCalledWith([
        {
          target: mockParams.to,
          data: mockParams.data,
          value: mockParams.value || 0n,
        },
      ]);
    });

    it('should throw error if not initialized', async () => {
      await expect(wallet.writeContract(mockParams)).rejects.toThrow('Kernel account not initialized');
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
      const { encodeCallDataForKernel } = require('../utils/encode-transactions');
      (encodeCallDataForKernel as jest.Mock).mockReturnValue('0xBatchEncodedData');
    });

    it('should execute batch contract writes', async () => {
      const result = await wallet.writeContracts(mockParams);

      expect(result).toEqual([mockTxHash]);

      // Verify encoding
      const { encodeCallDataForKernel } = require('../utils/encode-transactions');
      expect(encodeCallDataForKernel).toHaveBeenCalledWith([
        {
          target: mockParams[0].to,
          data: mockParams[0].data,
          value: mockParams[0].value || 0n,
        },
        {
          target: mockParams[1].to,
          data: mockParams[1].data,
          value: mockParams[1].value || 0n,
        },
      ]);

      // Verify transaction sent to kernel account
      expect(mockKernelClient.sendTransaction).toHaveBeenCalledWith({
        to: mockAddress,
        data: '0xBatchEncodedData',
        value: 1000000000000000000n, // Total value
      });
    });

    it('should handle writeContracts options with value', async () => {
      const options = { value: 2000000000000000000n };
      await wallet.writeContracts(mockParams, options);

      expect(mockKernelClient.sendTransaction).toHaveBeenCalledWith({
        to: mockAddress,
        data: '0xBatchEncodedData',
        value: 2000000000000000000n, // Options value overrides
      });
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

      expect(mockKernelClient.sendTransaction).toHaveBeenCalledWith({
        to: mockAddress,
        data: '0xBatchEncodedData',
        value: 3000000000000000000n, // Sum of values
      });
    });

    it('should handle empty params', async () => {
      const result = await wallet.writeContracts([]);

      expect(result).toEqual([mockTxHash]);
      
      const { encodeCallDataForKernel } = require('../utils/encode-transactions');
      expect(encodeCallDataForKernel).toHaveBeenCalledWith([]);
    });

    it('should ignore keepSender option', async () => {
      // Kernel wallet always keeps sender (smart account)
      const result = await wallet.writeContracts(mockParams, { keepSender: false });

      expect(result).toEqual([mockTxHash]);
      // Should still use kernel encoding, not multicall
    });

    it('should throw error if not initialized', async () => {
      // Create new wallet instance - the constructor in the real implementation might have different args
      // but for the test we just want to test the uninitialized state
      const newWallet = Object.create(KernelWallet.prototype);
      newWallet.kernelAccount = null;
      
      await expect(newWallet.writeContracts(mockParams)).rejects.toThrow('Kernel account not initialized');
    });
  });
});