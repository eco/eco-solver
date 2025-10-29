import { decodeAbiParameters, encodeFunctionData, erc20Abi, getAddress, Hex, keccak256, zeroAddress } from 'viem';

import { Call, Intent } from '@/common/interfaces/intent.interface';
import { toUniversalAddress } from '@/common/types/universal-address.type';

import { ClaimData } from '../types/rhinestone-order.types';

type RhinestoneOrder = ClaimData['order'];

const NATIVE_TOKEN = zeroAddress;

enum ExecutionType {
  Eip712Hash = 1,
  Calldata = 2,
  ERC7579 = 3,
  MultiCall = 4,
}

type Execution = {
  target: `0x${string}`;
  value: bigint;
  callData: Hex;
};

function toAddress(id: bigint): `0x${string}` {
  return getAddress(`0x${id.toString(16).padStart(40, '0').slice(-40)}`);
}

function decodeQualifier(qualifier: Hex) {
  const data = qualifier.slice(2);
  return {
    inbox: ('0x' + data.slice(0, 40)) as `0x${string}`,
    prover: ('0x' + data.slice(40, 80)) as `0x${string}`,
    id: ('0x' + data.slice(80, 144)) as Hex,
  };
}

function decodeInbox(qualifier: Hex): `0x${string}` {
  const { inbox } = decodeQualifier(qualifier);
  return inbox;
}

function getExecutionType(operation: { data: Hex }): ExecutionType {
  if (operation.data.length === 0 || operation.data === '0x') {
    return ExecutionType.Eip712Hash;
  }
  const typeByte = parseInt(operation.data.slice(2, 4), 16);
  return typeByte as ExecutionType;
}

function decodeERC7579Batch(data: Hex): Execution[] {
  const dataWithoutType = `0x${data.slice(4)}` as Hex;
  const decoded = decodeAbiParameters([{ type: 'bytes', name: 'executionData' }], dataWithoutType);
  const executionBytes = decoded[0] as Hex;

  return decodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    executionBytes
  )[0] as Execution[];
}

function decodeCalldata(data: Hex): { target: `0x${string}`; callData: Hex } {
  const dataWithoutType = `0x${data.slice(4)}` as Hex;
  const target = `0x${dataWithoutType.slice(2, 42)}` as `0x${string}`;
  const callData = `0x${dataWithoutType.slice(42)}` as Hex;

  return { target: getAddress(target), callData };
}

function encodeTargetExecutions(tokenLength: number, order: RhinestoneOrder): Call[] {
  const ops = order.targetOps;
  const execType = getExecutionType(ops);

  const calls: Call[] = [];

  if (execType === ExecutionType.MultiCall) {
    const executions = decodeERC7579Batch(ops.data);

    for (let i = 0; i < executions.length; i++) {
      calls[tokenLength + i] = {
        target: toUniversalAddress(executions[i].target),
        value: executions[i].value,
        data: executions[i].callData,
      };
    }
  } else if (execType === ExecutionType.Calldata) {
    const { target, callData } = decodeCalldata(ops.data);

    calls[tokenLength] = {
      target: toUniversalAddress(target),
      value: 0n,
      data: callData,
    };
  }

  return calls;
}

export function extractIntent(claimData: ClaimData, claimHash: Hex, sourceChainId: number): Intent {
  const order = claimData.order;
  const inbox = decodeInbox(order.qualifier);
  const { prover } = decodeQualifier(order.qualifier);

  // Build tokens and calls for route
  const tokens: { amount: bigint; token: ReturnType<typeof toUniversalAddress> }[] = [];
  const tokenTransferCalls: Call[] = [];

  for (const [tokenId, amount] of order.tokenOut) {
    const tokenAddress = toAddress(tokenId);

    if (tokenAddress !== NATIVE_TOKEN) {
      tokens.push({
        token: toUniversalAddress(tokenAddress),
        amount: amount,
      });

      tokenTransferCalls.push({
        target: toUniversalAddress(tokenAddress),
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [order.recipient, amount],
        }),
      });
    } else {
      tokenTransferCalls.push({
        target: toUniversalAddress(order.recipient),
        value: amount,
        data: '0x' as Hex,
      });
    }
  }

  const targetCalls = encodeTargetExecutions(tokenTransferCalls.length, order);
  const calls = [...tokenTransferCalls, ...targetCalls.slice(tokenTransferCalls.length)];

  // Build reward tokens
  const rewardTokens: { amount: bigint; token: ReturnType<typeof toUniversalAddress> }[] = order.tokenIn.map(
    ([tokenId, amount]) => ({
      token: toUniversalAddress(toAddress(tokenId)),
      amount: amount,
    })
  );

  // Compute intent hash
  const salt = `0x${order.nonce.toString(16).padStart(64, '0')}` as Hex;
  const intentHash = keccak256(
    `0x${salt.slice(2)}${order.targetChainId.toString(16).padStart(16, '0')}${inbox.slice(2)}${claimHash.slice(2)}` as Hex
  );

  return {
    intentHash,
    destination: order.targetChainId,
    sourceChainId: BigInt(sourceChainId),
    route: {
      salt,
      deadline: order.fillDeadline,
      portal: toUniversalAddress(inbox),
      nativeAmount: 0n,
      tokens,
      calls,
    },
    reward: {
      deadline: order.fillDeadline,
      creator: toUniversalAddress(order.sponsor),
      prover: toUniversalAddress(prover),
      nativeAmount: 0n,
      tokens: rewardTokens,
    },
  };
}
