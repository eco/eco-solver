import { Address, Chain, Hex } from 'viem';

import { EvmCall, WriteContractsOptions } from '@/common/interfaces/evm-wallet.interface';

import { BasicWallet } from '../basic-wallet';

describe('BasicWallet', () => {
  let wallet: BasicWallet;
  let mockPublicClient: any;
  let mockWalletClient: any;

  const mockAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockTxHash = '0xTransactionHash' as Hex;
  const mockMulticall3Address = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;

  const mockChain: Chain = {
    id: 1,
    name: 'Ethereum',
    contracts: {
      multicall3: {
        address: mockMulticall3Address,
      },
    },
  } as Chain;

  beforeEach(() => {
    mockPublicClient = {
      chain: mockChain,
      simulateContract: jest.fn().mockImplementation((args) => {
        return Promise.resolve({
          request: {
            ...args,
          },
        });
      }),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 'success' }),
    };

    mockWalletClient = {
      account: {
        address: mockAddress,
      },
      writeContract: jest.fn().mockResolvedValue(mockTxHash),
      sendTransaction: jest.fn().mockResolvedValue(mockTxHash),
    };

    wallet = new BasicWallet(mockPublicClient, mockWalletClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAddress', () => {
    it('should return wallet address', async () => {
      const address = await wallet.getAddress();
      expect(address).toBe(mockAddress);
    });
  });

  describe('writeContract', () => {
    it('should execute single contract write', async () => {
      const params: EvmCall = {
        to: '0xContractAddress' as Address,
        data: '0x1234' as Hex,
        value: 0n,
      };

      const result = await wallet.writeContract(params);

      expect(result).toBe(mockTxHash);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(params);
    });

    it('should handle contract write with value', async () => {
      const params: EvmCall = {
        to: '0xContractAddress' as Address,
        data: '0x5678' as Hex,
        value: 1000000000000000000n,
      };

      const result = await wallet.writeContract(params);

      expect(result).toBe(mockTxHash);
      expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(params);
    });
  });

  describe('writeContracts', () => {
    const mockParams: EvmCall[] = [
      {
        to: '0xToken1' as Address,
        data: '0xapprove1' as Hex,
        value: 0n,
      },
      {
        to: '0xToken2' as Address,
        data: '0xapprove2' as Hex,
        value: 0n,
      },
    ];

    describe('with keepSender: false (multicall)', () => {
      it('should execute batch writes using multicall3', async () => {
        const result = await wallet.writeContracts(mockParams);

        expect(result).toEqual([mockTxHash]);

        // Should simulate the multicall
        expect(mockPublicClient.simulateContract).toHaveBeenCalledWith({
          address: mockMulticall3Address,
          abi: expect.any(Array),
          functionName: 'aggregate3Value',
          args: expect.any(Array),
          value: 0n,
          account: {
            address: mockAddress,
          },
        });

        // Should execute the multicall
        expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
          address: mockMulticall3Address,
          abi: expect.any(Array),
          functionName: 'aggregate3Value',
          args: expect.any(Array),
          value: 0n,
          account: {
            address: mockAddress,
          },
        });
      });

      it('should handle batch writes with value', async () => {
        const paramsWithValue: EvmCall[] = [
          ...mockParams,
          {
            to: '0xContract' as Address,
            data: '0xdeposit' as Hex,
            value: 1000000000000000000n,
          },
        ];

        await wallet.writeContracts(paramsWithValue, { value: 2000000000000000000n });

        // Should use the provided value
        expect(mockPublicClient.simulateContract).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 2000000000000000000n,
            account: {
              address: mockAddress,
            },
          }),
        );

        expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
          address: mockMulticall3Address,
          abi: expect.any(Array),
          functionName: 'aggregate3Value',
          args: expect.any(Array),
          value: 2000000000000000000n,
          account: {
            address: mockAddress,
          },
        });
      });

      it('should calculate total value from individual calls', async () => {
        const paramsWithValues: EvmCall[] = [
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

        // Should calculate total value (1 + 2 = 3 ETH)
        expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
          address: mockMulticall3Address,
          abi: expect.any(Array),
          functionName: 'aggregate3Value',
          args: expect.any(Array),
          value: 3000000000000000000n,
          account: {
            address: mockAddress,
          },
        });
      });

      it('should handle simulation failure', async () => {
        mockPublicClient.simulateContract.mockRejectedValue(new Error('Simulation failed'));

        await expect(wallet.writeContracts(mockParams)).rejects.toThrow('Simulation failed');
      });

      it('should throw error if multicall3 not available', async () => {
        mockPublicClient.chain = { id: 1, name: 'Test' };

        await expect(wallet.writeContracts(mockParams)).rejects.toThrow(
          'Multicall3 address not found for chain 1',
        );
      });
    });

    describe('with keepSender: true (sequential)', () => {
      const options: WriteContractsOptions = { keepSender: true };

      it('should execute transactions sequentially', async () => {
        const result = await wallet.writeContracts(mockParams, options);

        expect(result).toEqual([mockTxHash, mockTxHash]);
        expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(2);

        // Should not use multicall
        expect(mockPublicClient.simulateContract).not.toHaveBeenCalled();
      });

      it('should preserve individual transaction parameters', async () => {
        const paramsWithDifferentValues: EvmCall[] = [
          {
            to: '0xContract1' as Address,
            data: '0xmethod1' as Hex,
            value: 100n,
          },
          {
            to: '0xContract2' as Address,
            data: '0xmethod2' as Hex,
            value: 200n,
          },
        ];

        await wallet.writeContracts(paramsWithDifferentValues, options);

        expect(mockWalletClient.sendTransaction).toHaveBeenNthCalledWith(
          1,
          paramsWithDifferentValues[0],
        );
        expect(mockWalletClient.sendTransaction).toHaveBeenNthCalledWith(
          2,
          paramsWithDifferentValues[1],
        );
      });

      it('should handle errors in sequential execution', async () => {
        mockWalletClient.sendTransaction
          .mockResolvedValueOnce(mockTxHash)
          .mockRejectedValueOnce(new Error('Transaction failed'));

        await expect(wallet.writeContracts(mockParams, options)).rejects.toThrow(
          'Transaction failed',
        );

        // Should have attempted both transactions
        expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(2);
      });
    });

    describe('edge cases', () => {
      it('should handle empty params array', async () => {
        const result = await wallet.writeContracts([]);
        expect(result).toEqual([]);
        expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
      });

      it('should handle single transaction', async () => {
        const result = await wallet.writeContracts([mockParams[0]]);

        // Single transaction uses sequential path (keepSender defaults to false, but length === 1 triggers sequential)
        expect(result).toEqual([mockTxHash]);
        expect(mockWalletClient.sendTransaction).toHaveBeenCalledTimes(1);
        expect(mockWalletClient.sendTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            to: mockParams[0].to,
            data: mockParams[0].data,
            value: mockParams[0].value,
          }),
        );
      });
    });
  });
});
