import { decodeFunctionData, Hex } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'

/**
 * Decode a router call from raw hex data
 * @param data The encoded function data
 * @returns Decoded function name and arguments
 */
export function decodeRouterCall(data: Hex) {
  return decodeFunctionData({ abi: rhinestoneRouterAbi, data })
}

/**
 * Decode an adapter claim call and extract claim data
 * @param data The encoded adapter claim call data
 * @returns The claim data from eco_handleClaim function
 * @throws {EcoError} If the decoded function is not eco_handleClaim
 */
export function decodeAdapterClaim(data: Hex) {
  const decoded = decodeFunctionData({
    abi: ecoAdapterAbi,
    data,
  })

  if (decoded.functionName === 'eco_handleClaim') {
    return decoded.args[0]
  }

  throw EcoError.InvalidDecodedFunctionData(decoded.functionName)
}

/**
 * Decode an adapter fill call and extract fill arguments
 * @param data The encoded adapter fill call data
 * @returns The arguments from eco_handleFill_ERC7579 function
 * @throws {EcoError} If the decoded function is not eco_handleFill_ERC7579
 */
export function decodeAdapterFill(data: Hex) {
  const decoded = decodeFunctionData({ abi: ecoAdapterAbi, data })

  if (decoded.functionName === 'eco_handleFill_ERC7579') {
    return decoded.args
  }

  throw EcoError.InvalidDecodedFunctionData(decoded.functionName)
}
