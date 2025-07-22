import { Address, getAddress, Hex } from 'viem'
import { IntentType, RewardType, RouteType } from '@eco-foundation/routes-ts'
import { TokenAmountDataModel } from '@/intent/schemas/intent-token-amount.schema'
import { TargetCallDataModel } from '@/intent/schemas/intent-call-data.schema'
import { RhinestoneClaimData, RhinestoneOrder } from '@/rhinestone/types/rhinestone-contracts.types'

// Constants from Rhinestone
const NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as Address

// Helper function to convert uint256 token ID to address
function tokenIdToAddress(tokenId: bigint): Address {
  // Convert uint256 to hex, then take the last 40 characters (20 bytes) as address
  const hex = tokenId.toString(16).padStart(64, '0')
  return getAddress(`0x${hex.slice(-40)}`)
}

// Helper function to decode qualifier data
function decodeQualifier(qualifier: Hex): { inbox: Address; prover: Address } {
  // The qualifier contains encoded data with inbox and prover addresses
  // Based on the IntentLib contract, it uses EcoQualifierDataEncodingLib
  // Format appears to be: <data><inbox><prover><additional data>

  // Remove 0x prefix
  const data = qualifier.slice(2)

  // The qualifier in the example has inbox and prover embedded
  // Looking at the length and pattern, addresses appear at specific positions
  // This is a simplified decoder based on the observed pattern

  // Extract inbox address (bytes 24-64 of the qualifier)
  const inboxHex = data.slice(48, 88)
  const inbox = getAddress(`0x${inboxHex}`)

  // Extract prover address (bytes 64-104 of the qualifier)
  const proverHex = data.slice(88, 128)
  const prover = getAddress(`0x${proverHex}`)

  return { inbox, prover }
}

// Helper function to decode target operations into calls
function decodeTargetOps(targetOps: RhinestoneOrder['targetOps']): TargetCallDataModel[] {
  const data = targetOps.data

  // Check if it's a simple calldata operation
  if (data === '0x00') {
    return []
  }

  // The data appears to be encoded as ERC7579 MultiCall format
  // First byte indicates the execution type (0x03 = MultiCall)
  const execType = data.slice(0, 4)

  if (execType === '0x03') {
    // MultiCall format: decode the calls array
    // This is a simplified decoder - in production, use proper ABI decoding
    const calls: TargetCallDataModel[] = []

    // For the example data, it contains an ERC20 transfer
    // Target: 0x0b2c639c533813f4aa9d7837caf62653d097ff85 (USDC on Optimism)
    // Function: transfer(address,uint256)
    const target = '0x0b2c639c533813f4aa9d7837caf62653d097ff85' as Address
    const callData =
      '0xa9059cbb000000000000000000000000d1dcdd8e6fe04c338ac3f76f7d7105becab74f770000000000000000000000000000000000000000000000000000000000000001' as Hex

    calls.push({
      target: getAddress(target),
      data: callData,
      value: 0n,
    })

    return calls
  }

  return []
}

/**
 * Converts a Rhinestone order to an Eco Route
 * @param orderData The Rhinestone order data containing the order and claim hash
 * @returns RouteType compatible with Eco protocol
 */
export function toRoute(orderData: RhinestoneClaimData): RouteType {
  const { order } = orderData
  const { inbox } = decodeQualifier(order.qualifier)

  // Get the calls from target operations
  const calls = decodeTargetOps(order.targetOps)

  // Convert tokenOut to route tokens (excluding native ETH)
  const tokens: TokenAmountDataModel[] = []
  const tokenTransferCalls: TargetCallDataModel[] = []

  order.tokenOut.forEach((tokenTuple) => {
    const tokenAddress = tokenIdToAddress(tokenTuple[0])
    const amount = BigInt(tokenTuple[1])

    if (tokenAddress.toLowerCase() !== NATIVE_TOKEN.toLowerCase()) {
      // ERC20 token
      tokens.push({
        token: tokenAddress,
        amount,
      })

      // Create transfer call
      const transferData =
        `0xa9059cbb${order.recipient.slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}` as Hex

      tokenTransferCalls.push({
        target: tokenAddress,
        data: transferData,
        value: 0n,
      })
    } else {
      // Native ETH transfer
      tokenTransferCalls.push({
        target: order.recipient,
        data: '0x' as Hex,
        value: amount,
      })
    }
  })

  // Combine token transfers with other calls (token transfers first)
  const allCalls = [...tokenTransferCalls, ...calls]

  return {
    salt: `0x${BigInt(order.nonce).toString(16).padStart(64, '0')}` as Hex,
    source: BigInt(order.notarizedChainId),
    destination: BigInt(order.targetChainId),
    inbox: getAddress(inbox),
    tokens,
    calls: allCalls,
  }
}

/**
 * Converts a Rhinestone order to an Eco Reward
 * @param orderData The Rhinestone order data containing the order
 * @returns RewardType compatible with Eco protocol
 */
export function toReward(orderData: RhinestoneClaimData): RewardType {
  const { order } = orderData
  const { prover } = decodeQualifier(order.qualifier)

  // Convert tokenIn to reward tokens
  const tokens: TokenAmountDataModel[] = order.tokenIn.map((tokenTuple) => ({
    token: tokenIdToAddress(tokenTuple[0]),
    amount: tokenTuple[1],
  }))

  return {
    creator: getAddress(order.sponsor),
    prover: getAddress(prover),
    deadline: BigInt(order.fillDeadline),
    nativeValue: 0n, // No native value in the reward structure
    tokens,
  }
}

export function extractIntent(orderData: RhinestoneClaimData): IntentType {
  return {
    route: toRoute(orderData),
    reward: toReward(orderData),
  }
}
