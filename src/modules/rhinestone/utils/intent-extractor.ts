import {
  decodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  Hex,
  keccak256,
  zeroAddress,
} from 'viem';

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
  if (id < 0n) {
    throw new RangeError('id must be a non-negative bigint');
  }
  return getAddress(`0x${id.toString(16).padStart(40, '0').slice(-40)}`);
}

/**
 * Decodes the ECO Arbiter qualifier which contains only the prover address (20 bytes).
 * According to EcoQualifierDataEncodingLib, the qualifier format is:
 * - Bytes 0-19: prover address (20 bytes)
 *
 * @param qualifier The qualifier hex string (should be 20 bytes = 42 chars including '0x')
 * @returns The prover address
 */
function decodeQualifier(qualifier: Hex): `0x${string}` {
  if (qualifier.length !== 42) {
    throw new Error(
      `Invalid qualifier length: expected 42 chars (20 bytes), got ${qualifier.length}`,
    );
  }
  return getAddress(qualifier);
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
    executionBytes,
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

/**
 * Extracts an Intent from Rhinestone claim data.
 *
 * @param claimData The decoded claim data from the Rhinestone order
 * @param claimHash The hash of the claim calldata
 * @param sourceChainId The chain ID where the claim originated
 * @param portal The Eco portal address (from ClaimAction.metadata.settlementLayer)
 * @returns The extracted Intent ready for fulfillment
 */
export function extractIntent(
  claimData: ClaimData,
  claimHash: Hex,
  sourceChainId: number,
  portal: `0x${string}`,
): Intent {
  const order = claimData.order;
  const prover = decodeQualifier(order.qualifier);

  // Build tokens and calls for route
  const tokens: { amount: bigint; token: ReturnType<typeof toUniversalAddress> }[] = [];
  const tokenTransferCalls: Call[] = [];
  let routeNativeAmount = 0n;

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
      routeNativeAmount += amount;
      tokenTransferCalls.push({
        target: toUniversalAddress(order.recipient),
        value: amount,
        data: '0x' as Hex,
      });
    }
  }

  const targetCalls = encodeTargetExecutions(tokenTransferCalls.length, order);
  const calls = [...tokenTransferCalls, ...targetCalls.slice(tokenTransferCalls.length)];

  // Build reward tokens and accumulate native amount
  const rewardTokens: { amount: bigint; token: ReturnType<typeof toUniversalAddress> }[] = [];
  let rewardNativeAmount = 0n;

  for (const [tokenId, amount] of order.tokenIn) {
    const tokenAddress = toAddress(tokenId);
    if (tokenAddress === NATIVE_TOKEN) {
      rewardNativeAmount += amount;
    } else {
      rewardTokens.push({
        token: toUniversalAddress(tokenAddress),
        amount: amount,
      });
    }
  }

  // Compute intent hash
  const salt = `0x${order.nonce.toString(16).padStart(64, '0')}` as Hex;
  const intentHash = keccak256(
    `0x${salt.slice(2)}${order.targetChainId.toString(16).padStart(16, '0')}${portal.slice(2)}${claimHash.slice(2)}` as Hex,
  );

  return {
    intentHash,
    destination: order.targetChainId,
    sourceChainId: BigInt(sourceChainId),
    route: {
      salt,
      deadline: order.fillDeadline,
      portal: toUniversalAddress(portal),
      nativeAmount: routeNativeAmount,
      tokens,
      calls,
    },
    reward: {
      deadline: order.fillDeadline,
      creator: toUniversalAddress(order.sponsor),
      prover: toUniversalAddress(prover),
      nativeAmount: rewardNativeAmount,
      tokens: rewardTokens,
    },
  };
}
