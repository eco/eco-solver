import { decodeFunctionData, Hex } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'

export function decodeRouterCall(data: Hex) {
  return decodeFunctionData({ abi: rhinestoneRouterAbi, data })
}

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

export function decodeAdapterFill(data: Hex) {
  const decoded = decodeFunctionData({ abi: ecoAdapterAbi, data })

  if (decoded.functionName === 'eco_handleFill_ERC7579') {
    return decoded.args
  }

  throw EcoError.InvalidDecodedFunctionData(decoded.functionName)
}
