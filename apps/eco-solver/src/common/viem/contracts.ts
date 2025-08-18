import {
  Abi,
  ContractFunctionName,
  Hex,
  prepareEncodeFunctionData,
  PrepareEncodeFunctionDataParameters,
  slice as vslice,
} from 'viem'

/**
 * Gets the hex selector of the function.
 * @param parameters the parameters to encode, abi and functionName
 * @returns the hex selector of the function
 */
export function getSelector<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi>,
>(parameters: PrepareEncodeFunctionDataParameters<abi, functionName>): Hex {
  return prepareEncodeFunctionData(parameters).functionName
}

// Get the first 4 bytes of the data that is the hash of the function signature
export function getFunctionBytes(data: Hex): Hex {
  return vslice(data, 0, 4)
}
