import { Address, decodeFunctionData, Hex, parseAbi } from 'viem'

/**
 * Function selectors for router call types
 */
const SELECTORS = {
  singleCall: '0x8f5d232d', // singleCall(address,bytes)
  multiCall: '0xac9650d8', // multiCall((address,uint256,bytes)[])
  multiCallWithDrainToken: '0x3f579497', // multiCallWithDrainToken((address,uint256,bytes)[],uint256[2][],address)
} as const

/**
 * ABI for multiCall function
 */
const MULTI_CALL_ABI = parseAbi([
  'function multiCall((address target, uint256 value, bytes callData)[] executions)',
])

/**
 * Decodes the calls that would be executed by the _routeFill function in RouterLogic.sol
 *
 * @param adapterCalldata - The calldata passed to _routeFill
 * @returns The decoded call information with type, selector, and executions (if applicable)
 */
export function decodeRouteFillCall(adapterCalldata: Hex) {
  // Extract the selector (first 4 bytes)
  const selector = adapterCalldata.slice(0, 10) as Hex

  // Handle singleCall
  if (selector === SELECTORS.singleCall) {
    // For singleCall, the actual calldata starts after the selector
    // The fallback function in Caller.sol expects: [target(20 bytes)][callData(...)]
    const callerCalldata = ('0x' + adapterCalldata.slice(10)) as Hex

    // Extract target address (first 20 bytes)
    const target = ('0x' + callerCalldata.slice(2, 42)) as Address

    // Extract the actual callData (everything after the target)
    const callData = ('0x' + callerCalldata.slice(42)) as Hex

    return {
      type: 'singleCall' as const,
      selector,
      executions: [{ target, callData, value: 0n }],
    }
  }

  // Handle multiCall
  if (selector === SELECTORS.multiCall) {
    const decoded = decodeFunctionData({
      abi: MULTI_CALL_ABI,
      data: adapterCalldata,
    })

    return {
      type: 'multiCall' as const,
      selector,
      executions: decoded.args[0],
    }
  }

  return {
    type: 'adapterCall' as const,
    selector,
  }
}
