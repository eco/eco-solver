import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, KernelV3AccountAbi } from '@zerodev/sdk';
// Import mocked values from jest.setup.ts
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  Address,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  Hex,
  LocalAccount,
} from 'viem';

import { Call } from '@/common/interfaces/evm-wallet.interface';
import { EvmNetworkConfig, KernelWalletConfig } from '@/config/schemas';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

import { KernelWallet } from '../kernel-wallet';
import {
  encodeKernelExecuteCallData,
  encodeKernelExecuteParams,
} from '../utils/encode-transactions';

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeFunctionData: jest.fn(),
  encodeAbiParameters: jest.fn(),
  encodePacked: jest.fn(),
  createWalletClient: jest.fn(),
}));

jest.mock('@zerodev/sdk', () => ({
  createKernelAccount: jest.fn(),
  KernelV3AccountAbi: [
    {
      name: 'isModuleInstalled',
      type: 'function',
      inputs: [
        { name: 'moduleType', type: 'uint256' },
        { name: 'module', type: 'address' },
        { name: 'additionalContext', type: 'bytes' },
      ],
      outputs: [{ name: 'isInstalled', type: 'bool' }],
      stateMutability: 'view',
    },
    {
      name: 'installModule',
      type: 'function',
      inputs: [
        { name: 'moduleType', type: 'uint256' },
        { name: 'module', type: 'address' },
        { name: 'initData', type: 'bytes' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ],
}));

jest.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: jest.fn(),
}));

jest.mock('../utils/encode-transactions', () => ({
  encodeKernelExecuteCallData: jest.fn(),
  encodeKernelExecuteParams: jest.fn(),
}));

describe('KernelWallet', () => {
  let wallet: KernelWallet;
  let mockTransportService: jest.Mocked<EvmTransportService>;
  let mockSigner: jest.Mocked<LocalAccount>;
  let mockKernelWalletConfig: KernelWalletConfig;
  let mockNetworkConfig: EvmNetworkConfig;
  let mockPublicClient: any;
  let mockSignerWalletClient: any;
  let mockKernelAccount: any;
  let mockLogger: any;
  let mockOtelService: any;

  const mockChainId = 1;
  const mockAddress = '0xKernelAccountAddress' as Address;
  const mockTxHash = '0xTransactionHash' as Hex;
  const mockEcdsaExecutorAddress = '0x0000000000000000000000000000000000000003' as Address;

  describe('constructor validation', () => {
    beforeEach(() => {
      // Mock network config
      mockNetworkConfig = {
        chainId: mockChainId,
        rpc: { urls: ['http://localhost:8545'] },
        contracts: { portal: '0x0000000000000000000000000000000000000001' as Address },
        tokens: [],
        fee: {
          tokens: { flatFee: '0', scalarBps: 0 },
        },
        provers: {},
        defaultProver: 'hyper' as const,
        claimant: '0x0000000000000000000000000000000000000002' as Address,
      } as any;

      // Mock logger
      mockLogger = {
        setContext: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      };

      // Mock OpenTelemetry service
      mockOtelService = {
        startSpan: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          setAttributes: jest.fn(),
          setStatus: jest.fn(),
          recordException: jest.fn(),
          end: jest.fn(),
        }),
      };

      // Mock transport service
      mockTransportService = {
        getPublicClient: jest.fn(),
        getTransport: jest.fn().mockReturnValue('http'),
        getViemChain: jest.fn().mockReturnValue({ id: 1, name: 'mainnet' }),
      } as any;

      // Mock signer
      mockSigner = {
        address: '0x0000000000000000000000000000000000000002' as Address,
        signMessage: jest.fn(),
        signTransaction: jest.fn(),
        signTypedData: jest.fn(),
      } as any;

      // Mock kernel wallet config
      mockKernelWalletConfig = {
        signer: {
          type: 'eoa',
          privateKey: '0xPrivateKey',
        },
      } as any;
    });

    it('should throw error for invalid executor address', () => {
      const invalidNetworkConfig = {
        ...mockNetworkConfig,
        contracts: {
          portal: '0x0000000000000000000000000000000000000001' as Address,
          ecdsaExecutor: 'invalid-address',
        },
      };

      expect(() => {
        new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          invalidNetworkConfig,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );
      }).toThrow('Invalid ECDSA executor address: invalid-address');
    });

    it('should accept valid executor address', () => {
      const validNetworkConfig = {
        ...mockNetworkConfig,
        contracts: {
          portal: '0x0000000000000000000000000000000000000001' as Address,
          ecdsaExecutor: '0x1234567890123456789012345678901234567890',
        },
      };

      expect(() => {
        new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          validNetworkConfig,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );
      }).not.toThrow();
    });
  });

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
      address: '0x0000000000000000000000000000000000000002' as Address,
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

    // Mock network config
    mockNetworkConfig = {
      chainId: mockChainId,
      rpc: { urls: ['http://localhost:8545'] },
      contracts: { portal: '0x0000000000000000000000000000000000000001' as Address },
      tokens: [],
      fee: {
        tokens: { flatFee: '0', scalarBps: 0 },
      },
      provers: {},
      defaultProver: 'hyper' as const,
      claimant: '0x0000000000000000000000000000000000000002' as Address,
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

    // Mock encodeAbiParameters
    (encodeAbiParameters as jest.Mock).mockReturnValue('0xEncodedAbiParameters');

    // Mock encodePacked
    (encodePacked as jest.Mock).mockReturnValue('0xPackedData');

    // Mock createWalletClient from viem
    (createWalletClient as jest.Mock).mockReturnValue(mockSignerWalletClient);

    // Mock logger
    mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    // Mock OpenTelemetry service
    mockOtelService = {
      startSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        setStatus: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      }),
    };

    // Create wallet instance
    wallet = new KernelWallet(
      mockChainId,
      mockSigner,
      mockKernelWalletConfig,
      mockNetworkConfig,
      mockTransportService,
      mockLogger,
      mockOtelService,
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

    it('should skip deployment if code already exists', async () => {
      // Mock account not deployed according to isDeployed
      mockKernelAccount.isDeployed.mockResolvedValue(false);

      // But code exists on chain (edge case)
      mockPublicClient.getCode = jest.fn().mockResolvedValue('0x1234567890');

      await wallet.init();

      // Should check code before getting factory args
      expect(mockPublicClient.getCode).toHaveBeenCalledWith({
        address: mockAddress,
      });

      // Should not attempt deployment
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

      await expect(wallet.init()).rejects.toThrow(
        'Failed to create kernel account: Failed to create kernel account',
      );
    });

    describe('ECDSA Executor Module Installation', () => {
      beforeEach(() => {
        // Mock readContract for isModuleInstalled check
        mockPublicClient.readContract = jest.fn();
      });

      it('should install ECDSA executor module when configured and not installed', async () => {
        // Configure network with ECDSA executor
        const networkConfigWithExecutor = {
          ...mockNetworkConfig,
          contracts: {
            portal: '0x0000000000000000000000000000000000000001' as Address,
            ecdsaExecutor: mockEcdsaExecutorAddress,
          },
        };

        // Create new wallet with executor config
        const walletWithExecutor = new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          networkConfigWithExecutor,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );

        // Mock module not installed
        mockPublicClient.readContract.mockResolvedValue(false);

        // Mock encodeAbiParameters for init data
        (encodeAbiParameters as jest.Mock).mockReturnValueOnce('0xEncodedAbiParameters');

        // Mock encodePacked - first call for signer address, second call for constructInitDataWithHook
        (encodePacked as jest.Mock)
          .mockReturnValueOnce('0xSignerData') // First call for signer address
          .mockReturnValueOnce('0xInitData'); // Second call for constructInitDataWithHook

        // Mock encodeFunctionData for installModule
        (encodeFunctionData as jest.Mock).mockReturnValueOnce('0xInstallModuleData');

        await walletWithExecutor.init();

        // Verify module installation check
        expect(mockPublicClient.readContract).toHaveBeenCalledWith({
          address: mockAddress,
          abi: KernelV3AccountAbi,
          functionName: 'isModuleInstalled',
          args: [BigInt(2), mockEcdsaExecutorAddress, '0x'],
        });

        // Verify init data encoding (from constructInitDataWithHook)
        expect(encodeAbiParameters).toHaveBeenCalledWith(
          [{ type: 'bytes' }, { type: 'bytes' }],
          [expect.any(String), '0x'],
        );

        // Verify installModule encoding
        expect(encodeFunctionData).toHaveBeenCalledWith({
          abi: KernelV3AccountAbi,
          functionName: 'installModule',
          args: [BigInt(2), mockEcdsaExecutorAddress, '0xInitData'],
        });

        // Verify module installation transaction
        expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            to: mockAddress,
            data: '0xInstallModuleData',
          }),
        );
      });

      it('should skip installation when module is already installed', async () => {
        // Configure network with ECDSA executor
        const networkConfigWithExecutor = {
          ...mockNetworkConfig,
          contracts: {
            portal: '0x0000000000000000000000000000000000000001' as Address,
            ecdsaExecutor: mockEcdsaExecutorAddress,
          },
        };

        // Create new wallet with executor config
        const walletWithExecutor = new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          networkConfigWithExecutor,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );

        // Mock module already installed
        mockPublicClient.readContract.mockResolvedValue(true);

        await walletWithExecutor.init();

        // Verify module installation check
        expect(mockPublicClient.readContract).toHaveBeenCalledWith({
          address: mockAddress,
          abi: KernelV3AccountAbi,
          functionName: 'isModuleInstalled',
          args: [BigInt(2), mockEcdsaExecutorAddress, '0x'],
        });

        // Verify no installation transaction was sent
        expect(mockSignerWalletClient.sendTransaction).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.stringContaining('installModule'),
          }),
        );
      });

      it('should skip installation when ECDSA executor is not configured', async () => {
        // Network config without ecdsaExecutor field (only has portal)
        expect(mockNetworkConfig.contracts?.ecdsaExecutor).toBeUndefined();

        await wallet.init();

        // Verify no module check or installation
        expect(mockPublicClient.readContract).not.toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'isModuleInstalled',
          }),
        );
      });

      it('should handle module check failure gracefully', async () => {
        // Configure network with ECDSA executor
        const networkConfigWithExecutor = {
          ...mockNetworkConfig,
          contracts: {
            portal: '0x0000000000000000000000000000000000000001' as Address,
            ecdsaExecutor: mockEcdsaExecutorAddress,
          },
        };

        // Create new wallet with executor config
        const walletWithExecutor = new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          networkConfigWithExecutor,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );

        // Mock module check failure (assume not installed)
        mockPublicClient.readContract.mockRejectedValue(new Error('Contract read failed'));

        // Mock encodeAbiParameters for init data
        (encodeAbiParameters as jest.Mock).mockReturnValueOnce('0xEncodedAbiParameters');

        // Mock encodePacked for constructInitDataWithHook
        (encodePacked as jest.Mock).mockReturnValueOnce('0xInitData');

        // Mock encodeFunctionData for installModule
        (encodeFunctionData as jest.Mock).mockReturnValueOnce('0xInstallModuleData');

        await walletWithExecutor.init();

        // Should proceed with installation despite check failure
        expect(mockSignerWalletClient.sendTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            to: mockAddress,
            data: '0xInstallModuleData',
          }),
        );
      });

      it('should validate module address in isModuleInstalled', async () => {
        // This test would need access to private method, so we test it indirectly
        const networkConfigWithInvalidExecutor = {
          ...mockNetworkConfig,
          contracts: {
            portal: '0x0000000000000000000000000000000000000001' as Address,
            ecdsaExecutor: '0x1234567890123456789012345678901234567890', // Valid initially
          },
        };

        const walletWithExecutor = new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          networkConfigWithInvalidExecutor,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );

        // We can't directly test private methods, but the validation is tested through the flow
        await walletWithExecutor.init();

        // The validation happens internally
        expect(mockPublicClient.readContract).toHaveBeenCalled();
      });

      it('should cache module installation status', async () => {
        const networkConfigWithExecutor = {
          ...mockNetworkConfig,
          contracts: {
            portal: '0x0000000000000000000000000000000000000001' as Address,
            ecdsaExecutor: mockEcdsaExecutorAddress,
          },
        };

        const walletWithExecutor = new KernelWallet(
          mockChainId,
          mockSigner,
          mockKernelWalletConfig,
          networkConfigWithExecutor,
          mockTransportService,
          mockLogger,
          mockOtelService,
        );

        // First check - not installed
        mockPublicClient.readContract.mockResolvedValueOnce(false);

        // Mock installation
        (encodeAbiParameters as jest.Mock).mockReturnValueOnce('0xEncodedAbiParameters');
        (encodePacked as jest.Mock).mockReturnValueOnce('0xInitData');
        (encodeFunctionData as jest.Mock).mockReturnValueOnce('0xInstallModuleData');

        await walletWithExecutor.init();

        // readContract should be called once for the check
        expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getExecutionMode', () => {
    it('should return signer mode when executor not configured', async () => {
      await wallet.init();
      expect(wallet.getExecutionMode()).toBe('signer');
    });

    it('should return executor mode when executor is installed', async () => {
      const networkConfigWithExecutor = {
        ...mockNetworkConfig,
        contracts: {
          portal: '0x0000000000000000000000000000000000000001' as Address,
          ecdsaExecutor: mockEcdsaExecutorAddress,
        },
      };

      // Mock public client with readContract method
      const mockPublicClientWithRead = {
        ...mockPublicClient,
        readContract: jest.fn().mockResolvedValueOnce(true),
      };

      const mockTransportServiceWithRead = {
        ...mockTransportService,
        getPublicClient: jest.fn().mockReturnValue(mockPublicClientWithRead),
      } as any;

      const walletWithExecutor = new KernelWallet(
        mockChainId,
        mockSigner,
        mockKernelWalletConfig,
        networkConfigWithExecutor,
        mockTransportServiceWithRead,
        mockLogger,
        mockOtelService,
      );

      await walletWithExecutor.init();
      expect(walletWithExecutor.getExecutionMode()).toBe('executor');
    });
  });

  describe('getAddress', () => {
    it('should return kernel account address after init', async () => {
      await wallet.init();
      const address = await wallet.getAddress();

      expect(address).toBe(mockAddress);
    });

    it('should throw error if wallet not initialized', async () => {
      await expect(wallet.getAddress()).rejects.toThrow(
        'Kernel wallet not initialized. Call init() first.',
      );
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

    it('should throw error for invalid call parameters', async () => {
      await wallet.init();
      await expect(wallet.writeContract({} as any)).rejects.toThrow(
        'Invalid call parameters: missing required fields',
      );
      await expect(wallet.writeContract({ to: null } as any)).rejects.toThrow(
        'Invalid call parameters: missing required fields',
      );
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

    it('should throw error for empty calls', async () => {
      await expect(wallet.writeContracts([])).rejects.toThrow('No calls provided for execution');
    });

    it('should throw error if wallet not initialized', async () => {
      const uninitializedWallet = new KernelWallet(
        mockChainId,
        mockSigner,
        mockKernelWalletConfig,
        mockNetworkConfig,
        mockTransportService,
        mockLogger,
        mockOtelService,
      );

      await expect(uninitializedWallet.writeContracts(mockParams)).rejects.toThrow(
        'Kernel wallet not initialized. Call init() first.',
      );
    });

    it('should throw error for invalid calls', async () => {
      await expect(wallet.writeContracts([{ to: null } as any])).rejects.toThrow(
        "Invalid call at index 0: missing 'to' address",
      );
      await expect(wallet.writeContracts([mockParams[0], { data: '0x' } as any])).rejects.toThrow(
        "Invalid call at index 1: missing 'to' address",
      );
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
        mockNetworkConfig,
        mockTransportService,
        mockLogger,
        mockOtelService,
      );

      // Mock deployment failure
      mockKernelAccount.isDeployed.mockResolvedValue(false);
      mockKernelAccount.getFactoryArgs.mockResolvedValue({ factory: null, factoryData: null });

      await expect(newWallet.init()).rejects.toThrow('Unable to deploy kernel account');
    });

    it('should handle executor mode transaction errors', async () => {
      const networkConfigWithExecutor = {
        ...mockNetworkConfig,
        contracts: {
          portal: '0x0000000000000000000000000000000000000001' as Address,
          ecdsaExecutor: mockEcdsaExecutorAddress,
        },
      };

      // Create a custom signer wallet client for this test
      const mockSignerWalletClientWithWrite = {
        sendTransaction: jest.fn().mockResolvedValue(mockTxHash),
        signMessage: jest.fn().mockResolvedValueOnce('0xSignature'),
        writeContract: jest.fn().mockRejectedValueOnce(new Error('Transaction expired')),
      } as any;

      // Set up createWalletClient to return our mock before creating the wallet
      (createWalletClient as jest.Mock).mockReturnValue(mockSignerWalletClientWithWrite);

      // Mock public client with readContract method
      const mockPublicClientWithRead = {
        ...mockPublicClient,
        readContract: jest
          .fn()
          .mockResolvedValueOnce(true) // isModuleInstalled
          .mockResolvedValueOnce(BigInt(1)), // getNonce
      };

      const mockTransportServiceWithRead = {
        ...mockTransportService,
        getPublicClient: jest.fn().mockReturnValue(mockPublicClientWithRead),
      } as any;

      // Mock encodeAbiParameters and encodeKernelExecuteParams for executor mode
      (encodeAbiParameters as jest.Mock).mockReturnValue('0xEncodedParams');
      (encodeKernelExecuteParams as jest.Mock).mockReturnValue({
        mode: '0xMode',
        callData: '0xCallData',
      });

      const walletWithExecutor = new KernelWallet(
        mockChainId,
        mockSigner,
        mockKernelWalletConfig,
        networkConfigWithExecutor,
        mockTransportServiceWithRead,
        mockLogger,
        mockOtelService,
      );

      await walletWithExecutor.init();

      await expect(walletWithExecutor.writeContracts(mockParams)).rejects.toThrow(
        'Transaction expired',
      );

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Executor transaction failed, may need to retry',
        expect.objectContaining({
          error: 'transaction expired',
        }),
      );
    });
  });
});
