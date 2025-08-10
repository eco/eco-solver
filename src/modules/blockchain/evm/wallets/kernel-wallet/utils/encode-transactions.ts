import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  type Hex,
  toBytes,
  toHex,
} from 'viem';

import { Call } from '@/common/interfaces/evm-wallet.interface';

type CallType = 'call' | 'delegatecall' | 'batchcall';

type ExecutionMode<callType extends CallType> = {
  type: callType;
  revertOnError?: boolean;
  selector?: Hex;
  context?: Hex;
};

type EncodeCallDataParams<callType extends CallType> = {
  mode: ExecutionMode<callType>;
  callData: Call[];
};

function parseCallType(callType: CallType) {
  switch (callType) {
    case 'call':
      return '0x00';
    case 'batchcall':
      return '0x01';
    case 'delegatecall':
      return '0xff';
  }
}

function encodeExecutionMode<callType extends CallType>({
  type,
  revertOnError,
  selector,
  context,
}: ExecutionMode<callType>): Hex {
  return encodePacked(
    ['bytes1', 'bytes1', 'bytes4', 'bytes4', 'bytes22'],
    [
      toHex(toBytes(parseCallType(type), { size: 1 })),
      toHex(toBytes(revertOnError ? '0x01' : '0x00', { size: 1 })),
      toHex(toBytes('0x0', { size: 4 })),
      toHex(toBytes(selector ?? '0x', { size: 4 })),
      toHex(toBytes(context ?? '0x', { size: 22 })),
    ],
  );
}

function encode7579Calls<callType extends CallType>({
  mode,
  callData,
}: EncodeCallDataParams<callType>): {
  mode: Hex;
  callData: Hex;
} {
  if (callData.length > 1 && mode?.type !== 'batchcall') {
    throw new Error(`mode ${JSON.stringify(mode)} does not supported for batchcall calldata`);
  }

  if (callData.length > 1) {
    return {
      mode: encodeExecutionMode(mode),
      callData: encodeAbiParameters(
        [
          {
            name: 'executionBatch',
            type: 'tuple[]',
            components: [
              {
                name: 'target',
                type: 'address',
              },
              {
                name: 'value',
                type: 'uint256',
              },
              {
                name: 'callData',
                type: 'bytes',
              },
            ],
          },
        ],
        [
          callData.map((arg) => {
            return {
              target: arg.to,
              value: arg.value ?? 0n,
              callData: arg.data ?? '0x',
            };
          }),
        ],
      ),
    };
  }

  if (callData.length === 0) {
    throw new Error('No calls to encode');
  }

  const call = callData[0];

  return {
    mode: encodeExecutionMode(mode),
    callData: concatHex([call.to, toHex(call.value ?? 0n, { size: 32 }), call.data ?? '0x']),
  };
}

function encode7579Tx<callType extends CallType>(params: EncodeCallDataParams<callType>): Hex {
  const executeAbi = [
    {
      type: 'function',
      name: 'execute',
      inputs: [
        {
          name: 'execMode',
          type: 'bytes32',
          internalType: 'ExecMode',
        },
        {
          name: 'executionCalldata',
          type: 'bytes',
          internalType: 'bytes',
        },
      ],
      outputs: [],
      stateMutability: 'payable',
    },
  ] as const;

  const { mode, callData } = encode7579Calls<callType>(params);

  return encodeFunctionData({
    abi: executeAbi,
    functionName: 'execute',
    args: [mode, callData],
  });
}

export function encodeKernelExecuteCallData(calls: Call[]) {
  return encode7579Tx({
    mode: {
      type: calls.length > 1 ? 'batchcall' : 'call',
      revertOnError: false,
      selector: '0x',
      context: '0x',
    },
    callData: calls,
  });
}

export function encodeKernelExecuteParams(calls: Call[]) {
  return encode7579Calls({
    mode: {
      type: calls.length > 1 ? 'batchcall' : 'call',
      revertOnError: false,
      selector: '0x',
      context: '0x',
    },
    callData: calls,
  });
}
