import { EcoError } from '@/common/errors/eco-error'
import { getFunctionBytes } from '@/common/viem/contracts'
import { CallDataInterface, getERCAbi } from '@/contracts'
import { Solver, TargetContract, VmType, getVmType } from '@/eco-configs/eco-config.types'
import { TransactionTargetData } from '@/intent/utils-intent.service'
import { includes } from 'lodash'
import {
  decodeFunctionData,
  DecodeFunctionDataReturnType,
  extractChain,
  toFunctionSelector,
} from 'viem'
import { mainnet } from 'viem/chains'
import { ValidationIntentInterface } from './validation.sevice'
import { Logger } from '@nestjs/common'
import { ChainsSupported } from '../common/chains/supported'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { isEmptyData } from '../common/viem/utils'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

// The default number of decimals for native tokens that we enfores for now
const DEFAULT_NATIVE_DECIMALS = 18
const ETH_SYMBOL = 'ETH'

/**
 * Decodes the function data for a target contract
 *
 * @param solver the solver for the intent
 * @param call the call to decode
 * @returns
 */
export function getTransactionTargetData(
  solver: Solver,
  call: CallDataInterface,
): TransactionTargetData | null {
  const targetConfig = solver.targets[call.target as string] as TargetContract
  console.log('MADDEN: targetConfig', call.target, solver.targets)
  if (!targetConfig) {
    //shouldn't happen since we do this.targetsSupported(model, solver) before this call
    throw EcoError.IntentSourceTargetConfigNotFound(call.target as string)
  }
  const selector = getFunctionBytes(call.data)
  // Check if this is a Solana chain
  const vmType = getVmType(Number(solver.chainID))
  let tx: DecodeFunctionDataReturnType

  // Handle Solana SPL token transfers
  if (vmType === VmType.SVM) {
    const targetAddress = call.target as string
    const dataHex = call.data as string
    const dataBytes = Buffer.from(dataHex.slice(2), 'hex')

    console.log('MADDEN: Parsing SVM call data:', dataBytes.toString('hex'))
    console.log('MADDEN: Call data length:', dataBytes.length)

    // Parse Borsh-serialized Calldata struct:
    // Based on Rust struct: { data: Vec<u8>, account_count: u8 }
    // Borsh format: data_length (4 bytes) + data + account_count (1 byte)

    let amount = 0n

    if (dataBytes.length >= 5) {
      // New Borsh format: data first, then account_count
      const dataLength = dataBytes.readUInt32LE(0)
      const instructionData = dataBytes.slice(4, 4 + dataLength)
      const accountCount = dataBytes[4 + dataLength]

      console.log('MADDEN: Parsed Calldata - data_length:', dataLength)
      console.log('MADDEN: Parsed Calldata - instruction_data:', instructionData.toString('hex'))
      console.log('MADDEN: Parsed Calldata - account_count:', accountCount)

      // Parse SPL token instruction to extract amount
      if (instructionData.length >= 9) {
        const instructionIndex = instructionData[0]

        // For SPL transfer instructions, amount is at bytes 1-8
        amount = instructionData.readBigUInt64LE(1)

        console.log('MADDEN: SPL Instruction index:', instructionIndex)
        console.log('MADDEN: Extracted transfer amount:', amount.toString())
      }
    } else {
      // Fall back to old simple format
      console.log('MADDEN: Using simple format fallback')
      amount = dataBytes.readBigUInt64LE(1)
    }

    tx = {
      functionName: 'transfer',
      args: [
        '', // recipient will be determined from accounts
        amount,
      ],
    }
  } else {
    // Original EVM logic
    tx = decodeFunctionData({
      abi: getERCAbi(targetConfig.contractType),
      data: call.data,
    })

    const supportedSelectors = targetConfig.selectors.map((s) => toFunctionSelector(s))
    const supported = tx && includes(supportedSelectors, selector)
    if (!supported) {
      return null
    }
  }
  return { decodedFunctionData: tx, selector, targetConfig }
}

/**
 * Gets the timeout in milliseconds for waiting for a transaction to be mined
 * on the given chain.
 * @param chainID the chain id
 * @returns the timeout or undefined if not set
 */
export function getWaitForTransactionTimeout(chainID: bigint) {
  switch (Number(chainID)) {
    case mainnet.id:
      return 1000 * 60 * 5 // 5 minutes
    default:
      return undefined
  }
}
/**
 * Checks if the intent has any input or output native value components. Indicating
 * that a native token is being used in the intent.
 * @param intent the intent to check
 * @returns
 */
export function isNativeIntent(intent: ValidationIntentInterface): boolean {
  return (
    intent.route.calls.some((call) => {
      return call.value > 0
    }) || intent.reward.nativeAmount > 0
  )
}

/**
 * Verifies that the intent has a route that is using the same native token on both chains
 *
 * @param intent the intent model
 * @returns
 */
export function equivalentNativeGas(intent: ValidationIntentInterface, logger: Logger) {
  const sourceChain = extractChain({
    chains: ChainsSupported,
    id: Number(intent.source),
  })

  const dstChain = extractChain({
    chains: ChainsSupported,
    id: Number(intent.destination),
  })
  if (!sourceChain || !dstChain) {
    logger.error(
      EcoLogMessage.fromDefault({
        message: `equivalentNativeGas: Chain not found`,
        properties: {
          intent,
        },
      }),
    )
    return false
  }
  //Forge decimals to be 18 for now, even though it might change in future when we need to support native gas normalization
  const sameDecimals =
    sourceChain.nativeCurrency.decimals == dstChain.nativeCurrency.decimals &&
    sourceChain.nativeCurrency.decimals == DEFAULT_NATIVE_DECIMALS
  const sameSymbol = sourceChain.nativeCurrency.symbol == dstChain.nativeCurrency.symbol
  if (!sameDecimals || !sameSymbol) {
    logger.error(
      EcoLogMessage.fromDefault({
        message: `equivalentNativeGas: Different native currency`,
        properties: {
          intent,
          sameDecimals,
          sameSymbol,
          source: sourceChain.nativeCurrency,
          dst: dstChain.nativeCurrency,
        },
      }),
    )
    return false
  }
  return true
}

/**
 * Iterates over the calls and returns those that do not have empty data
 * Note: The system does not support calls that have both executable data and native value.
 * Only pure transfers (value == 0) are considered valid function calls.
 * @param calls the calls to check
 * @returns
 */
export function getFunctionCalls(calls: CallDataInterface[]) {
  return calls.filter((call) => !isEmptyData(call.data) && call.value == 0n)
}

/**
 * Iterates over the calls and returns those that have empty data and send native value.
 * Note: The system does not support calls that have both executable data and native value.
 * Only pure native transfers (empty data + value > 0) are considered valid native calls.
 *
 * @param calls the calls to check
 * @returns Array of calls that transfer native tokens without executing any functions
 */
export function getNativeCalls(calls: CallDataInterface[]) {
  return calls.filter((call) => call.value > 0 && isEmptyData(call.data))
}

/**
 * Calculates the total native token value (ETH, MATIC, etc.) required to fulfill all native value transfers in the intent calls.
 * This includes the sum of all call.value fields for calls that transfer native tokens.
 *
 * @param calls - Array of call data interfaces from the intent route
 * @returns The total native value required in wei (base units) for all native transfers in the intent
 */
export function getNativeFulfill(calls: readonly CallDataInterface[]): bigint {
  const nativeCalls = getNativeCalls(calls as CallDataInterface[])
  return nativeCalls.reduce((acc, call) => {
    return acc + (call.value || 0n)
  }, 0n)
}

/**
 * Iterates over the calls and returns the targets that do not have empty data
 * @param calls the calls to check
 * @returns
 */
export function getFunctionTargets(calls: CallDataInterface[]) {
  return getFunctionCalls(calls).map((call) => call.target)
}

export function isNativeETH(intent: ValidationIntentInterface): boolean {
  const sourceChain = extractChain({
    chains: ChainsSupported,
    id: Number(intent.source),
  })
  const dstChain = extractChain({
    chains: ChainsSupported,
    id: Number(intent.destination),
  })
  if (!sourceChain || !dstChain) {
    return false
  }
  return (
    sourceChain.nativeCurrency.symbol == ETH_SYMBOL && dstChain.nativeCurrency.symbol == ETH_SYMBOL
  )
}
