import type { Address, Hex } from 'viem';

import { EvmCall } from '@/common/interfaces/evm-wallet.interface';

import { encodeKernelExecuteCallData } from '../utils/encode-transactions';

// Mock viem functions
const mockEncodeAbiParameters = jest.fn();
const mockEncodeFunctionData = jest.fn();
const mockEncodePacked = jest.fn();
const mockToBytes = jest.fn();
const mockToHex = jest.fn();
const mockConcatHex = jest.fn();

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  encodeAbiParameters: (...args: any[]) => mockEncodeAbiParameters(...args),
  encodeFunctionData: (...args: any[]) => mockEncodeFunctionData(...args),
  encodePacked: (...args: any[]) => mockEncodePacked(...args),
  toBytes: (...args: any[]) => mockToBytes(...args),
  toHex: (...args: any[]) => mockToHex(...args),
  concatHex: (...args: any[]) => mockConcatHex(...args),
}));

describe('encode-transactions', () => {
  const mockSingleCall: EvmCall = {
    to: '0x1234567890123456789012345678901234567890' as Address,
    value: 1000000000000000000n,
    data: '0xabcdef' as Hex,
  };

  const mockMultipleCalls: EvmCall[] = [
    {
      to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address,
      value: 100n,
      data: '0x1234' as Hex,
    },
    {
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address,
      value: 200n,
      data: '0x5678' as Hex,
    },
    {
      to: '0xcccccccccccccccccccccccccccccccccccccccc' as Address,
      value: 0n,
      data: '0x9abc' as Hex,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockEncodeFunctionData.mockReturnValue('0xEncodedFunctionData');
    mockEncodeAbiParameters.mockReturnValue('0xEncodedParameters');
    mockEncodePacked.mockReturnValue(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
    mockToBytes.mockImplementation((value) => value);
    mockToHex.mockImplementation((value) => value);
    mockConcatHex.mockImplementation((values) => values.join(''));
  });

  describe('encodeKernelExecuteCallData', () => {
    it('should encode single call correctly', () => {
      const result = encodeKernelExecuteCallData([mockSingleCall]);

      // Should use 'execute' function for single call
      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: 'execute',
            type: 'function',
          }),
        ]),
        functionName: 'execute',
        args: [
          expect.any(String), // Mode selector
          expect.any(String), // Encoded call data
        ],
      });

      expect(result).toBe('0xEncodedFunctionData');
    });

    it('should encode multiple calls as batch', () => {
      const result = encodeKernelExecuteCallData(mockMultipleCalls);

      // First encode the execution array
      expect(mockEncodeAbiParameters).toHaveBeenCalledWith(
        [
          {
            name: 'executionBatch',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'callData', type: 'bytes' },
            ],
          },
        ],
        [
          mockMultipleCalls.map((call) => ({
            target: call.to,
            value: call.value ?? 0n,
            callData: call.data ?? '0x',
          })),
        ],
      );

      // Then encode the execute function with mode selector
      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: 'execute',
            type: 'function',
          }),
        ]),
        functionName: 'execute',
        args: [
          expect.any(String), // Mode selector
          '0xEncodedParameters', // Encoded execution data
        ],
      });

      expect(result).toBe('0xEncodedFunctionData');
    });

    it('should handle empty calls array', () => {
      expect(() => encodeKernelExecuteCallData([])).toThrow('No calls to encode');
    });

    it('should handle calls with zero values', () => {
      const callsWithZeroValues: EvmCall[] = [
        {
          to: '0x1111111111111111111111111111111111111111' as Address,
          value: 0n,
          data: '0x00' as Hex,
        },
      ];

      encodeKernelExecuteCallData(callsWithZeroValues);

      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.any(Array),
        functionName: 'execute',
        args: [
          expect.any(String), // Mode selector
          expect.any(String), // Encoded call data
        ],
      });
    });

    it('should handle calls with empty data', () => {
      const callsWithEmptyData: EvmCall[] = [
        {
          to: '0x2222222222222222222222222222222222222222' as Address,
          value: 1000n,
          data: '0x' as Hex,
        },
      ];

      encodeKernelExecuteCallData(callsWithEmptyData);

      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.any(Array),
        functionName: 'execute',
        args: [
          expect.any(String), // Mode selector
          expect.any(String), // Encoded call data
        ],
      });
    });
  });

  describe('mode selector encoding', () => {
    it('should use correct mode selector for batch calls', () => {
      encodeKernelExecuteCallData(mockMultipleCalls);

      // Check that mode selector is constructed correctly
      const modeSelectorCall = mockEncodeFunctionData.mock.calls.find(
        (call: any) => call[0].functionName === 'execute' && call[0].args.length === 2,
      );

      expect(modeSelectorCall).toBeDefined();

      const modeSelector = modeSelectorCall[0].args[0];
      // Mode selector should start with 0x00 (call mode)
      expect(modeSelector).toMatch(/^0x00/);
    });
  });

  describe('error handling', () => {
    it('should propagate encoding errors', () => {
      const error = new Error('Encoding failed');
      mockEncodeFunctionData.mockImplementation(() => {
        throw error;
      });

      expect(() => encodeKernelExecuteCallData([mockSingleCall])).toThrow(error);
    });

    it('should handle invalid call data', () => {
      const invalidCall = {
        to: 'not-an-address' as Address,
        value: 'not-a-bigint' as any,
        data: 'not-hex' as Hex,
      };

      // The function should still attempt to encode
      // Actual validation would happen in viem
      expect(() => encodeKernelExecuteCallData([invalidCall])).not.toThrow();
    });
  });
});
