import { RewardType, RouteType } from '@eco-foundation/routes-ts'
import {
  Address,
  decodeAbiParameters,
  encodeFunctionData,
  getAddress,
  Hex,
  Mutable,
  zeroAddress,
} from 'viem'
import { RhinestoneOrder } from '@/rhinestone/types/rhinestone-contracts.types'

// Import Order type from contract ABI using Viem's generics
// This assumes you have the contract ABI available
export type Order = RhinestoneOrder

// Constants
const NATIVE_TOKEN = zeroAddress

// Execution type enum (matches SmartExecutionLib.Type)
enum ExecutionType {
  Eip712Hash = 1,
  Calldata = 2,
  ERC7579 = 3,
  MultiCall = 4,
}

// Type for ERC7579 Execution
type Execution = {
  target: Address
  value: bigint
  callData: Hex
}

// Helper function to convert uint256 to address (similar to IdLib.toAddress)
function toAddress(id: bigint): Address {
  // Take the lower 160 bits of the uint256 to get the address
  return getAddress(`0x${id.toString(16).padStart(40, '0').slice(-40)}`)
}

// Helper function to decode qualifier data
function decodeQualifier(qualifier: Hex): {
  inbox: Address
  prover: Address
  id: Hex
} {
  // Decode the qualifier bytes according to EcoQualifierDataEncodingLib
  const decoded = decodeAbiParameters(
    [
      { name: 'inbox', type: 'address' },
      { name: 'prover', type: 'address' },
      { name: 'id', type: 'bytes32' },
    ],
    qualifier,
  )

  return {
    inbox: decoded[0] as Address,
    prover: decoded[1] as Address,
    id: decoded[2] as Hex,
  }
}

// Helper function to decode inbox from qualifier
function decodeInbox(qualifier: Hex): Address {
  const { inbox } = decodeQualifier(qualifier)
  return inbox
}

// Helper function to get execution type from Operation
function getExecutionType(operation: { data: Hex }): ExecutionType {
  if (operation.data.length === 0 || operation.data === '0x') {
    return ExecutionType.Eip712Hash
  }
  // First byte determines the type
  const typeByte = parseInt(operation.data.slice(2, 4), 16)
  return typeByte as ExecutionType
}

// Helper function to decode ERC7579 batch execution
function decodeERC7579Batch(data: Hex): Execution[] {
  // Skip the first byte (type indicator)
  const dataWithoutType = `0x${data.slice(4)}` as Hex

  // Decode the batch structure
  // ERC7579 batch encoding: offset to array, then length, then array of execution pointers
  const decoded = decodeAbiParameters([{ type: 'bytes', name: 'executionData' }], dataWithoutType)

  // Parse the execution array
  const executionBytes = decoded[0] as Hex

  // Decode as array of executions
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
  )[0] as Execution[]
}

// Helper function to decode calldata execution
function decodeCalldata(data: Hex): { target: Address; callData: Hex } {
  // Skip the first byte (type indicator)
  const dataWithoutType = `0x${data.slice(4)}` as Hex

  // First 20 bytes are the target address
  const target = `0x${dataWithoutType.slice(2, 42)}` as Address

  // Remaining bytes are the calldata
  const callData = `0x${dataWithoutType.slice(42)}` as Hex

  return { target: getAddress(target), callData }
}

// Helper function to encode target executions
function encodeTargetExecutions(
  tokenLength: number,
  order: Order,
  claimHash: Hex,
  claimHashOracle: Address,
): RouteType['calls'] {
  const ops = order.targetOps
  const execType = getExecutionType(ops)

  let calls: Mutable<RouteType['calls']> = []

  if (execType === ExecutionType.MultiCall) {
    // Handle batch execution - multiple calls in a single transaction
    const executions = decodeERC7579Batch(ops.data)

    // Allocate array with space for token transfers at the beginning
    calls = new Array(tokenLength + executions.length)

    // Convert each ERC7579 execution to an Eco Call
    for (let i = 0; i < executions.length; i++) {
      calls[tokenLength + i] = {
        target: executions[i].target,
        value: executions[i].value,
        data: executions[i].callData,
      }
    }
  } else if (execType === ExecutionType.Calldata) {
    // Handle single calldata execution
    const { target, callData } = decodeCalldata(ops.data)

    calls = new Array(tokenLength + 1)
    calls[tokenLength] = {
      target,
      value: 0n,
      data: callData,
    }
  } else if (execType === ExecutionType.ERC7579) {
    // Handle claim hash storage
    calls = new Array(tokenLength + 1)

    // Store the claim hash in the oracle
    const storeClaimHashData = encodeFunctionData({
      abi: [
        {
          name: 'storeClaimHash',
          type: 'function',
          inputs: [
            { name: 'claimHash', type: 'bytes32' },
            { name: 'recipient', type: 'address' },
          ],
          outputs: [],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'storeClaimHash',
      args: [claimHash, order.recipient],
    })

    calls[tokenLength] = {
      target: claimHashOracle,
      value: 0n,
      data: storeClaimHashData,
    }
  }

  return calls
}

/**
 * Converts a Rhinestone Order to an Eco Route
 * @param order The Rhinestone order containing intent details and token outputs
 * @param claimHash Hash of the claim data for cross-chain verification
 * @param currentChainId The current chain ID (source chain)
 * @param claimHashOracle Optional address of the claim hash oracle (defaults to CLAIMHASH_ORACLE)
 * @returns The constructed Eco Route ready for execution
 */
export function toRoute(
  order: Order,
  claimHash: Hex,
  currentChainId: bigint,
  claimHashOracle: Address,
): RouteType {
  // Extract inbox address from qualifier
  const inbox = decodeInbox(order.qualifier)

  // Convert tokenOut to Eco tokens and calls
  const tokens: Mutable<RouteType['tokens']> = []
  const tokenTransferCalls: Mutable<RouteType['calls']> = []

  // Process each token output
  for (const [tokenId, amount] of order.tokenOut) {
    const tokenAddress = toAddress(tokenId)

    if (tokenAddress !== NATIVE_TOKEN) {
      // ERC20 token
      tokens.push({
        token: tokenAddress,
        amount: amount,
      })

      // Create transfer call
      tokenTransferCalls.push({
        target: tokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: [
            {
              name: 'transfer',
              type: 'function',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ type: 'bool' }],
              stateMutability: 'nonpayable',
            },
          ],
          functionName: 'transfer',
          args: [order.recipient, amount],
        }),
      })
    } else {
      // Native ETH transfer
      tokenTransferCalls.push({
        target: order.recipient,
        value: amount,
        data: '0x' as Hex,
      })
    }
  }

  // Get target execution calls
  const targetCalls = encodeTargetExecutions(
    tokenTransferCalls.length,
    order,
    claimHash,
    claimHashOracle,
  )

  // Combine token transfers and target operations
  const calls = [...tokenTransferCalls, ...targetCalls.slice(tokenTransferCalls.length)]

  return {
    salt: `0x${order.nonce.toString(16).padStart(64, '0')}` as `0x${string}`,
    source: currentChainId,
    destination: order.targetChainId,
    inbox: inbox,
    tokens: tokens,
    calls: calls,
  }
}

/**
 * Converts a Rhinestone Order to an Eco Reward
 * @param order The Rhinestone order containing reward details
 * @returns The constructed Eco Reward struct
 */
export function toReward(order: Order): RewardType {
  // Decode qualifier to get prover
  const { prover } = decodeQualifier(order.qualifier)

  // Convert tokenIn to reward tokens
  const tokens: RewardType['tokens'] = order.tokenIn.map(([tokenId, amount]) => ({
    token: toAddress(tokenId),
    amount: amount,
  }))

  return {
    creator: order.sponsor,
    prover: prover,
    deadline: order.fillDeadline,
    nativeValue: 0n, // No native ETH in reward structure
    tokens: tokens,
  }
}
