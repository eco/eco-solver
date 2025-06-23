import { EcoError } from '@/common/errors/eco-error'
import { getFunctionBytes } from '@/common/viem/contracts'
import { CallDataInterface, getERCAbi } from '@/contracts'
import { Solver, TargetContract } from '@/eco-configs/eco-config.types'
import { TransactionTargetData } from '@/intent/utils-intent.service'
import { includes } from 'lodash'
import { decodeFunctionData, extractChain, toFunctionSelector } from 'viem'
import { mainnet } from 'viem/chains'
import { ValidationIntentInterface } from './validation.sevice'
import { Logger } from '@nestjs/common'
import { ChainsSupported } from '../common/chains/supported'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { isEmptyData } from '../common/viem/utils'

// The default number of decimals for native tokens that we enfores for now
const DEFAULT_NATIVE_DECIMALS = 18

/**
 * The types of intent job id prefixes
 */
export type IntentJobServiceName =
  | 'create'
  | 'feasable'
  | 'validate'
  | 'fulfill'
  | 'withdrawal'
  | 'retry'

/**
 * The types of intent job id prefixes
 */
export type WatchJobServiceName =
  | 'watch-native'
  | 'watch-tokens'
  | 'watch-intent-funded'
  | 'watch-create-intent'
  | 'watch-fulfillement'
  | 'watch-withdrawal'
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
  if (!targetConfig) {
    //shouldn't happen since we do this.targetsSupported(model, solver) before this call
    throw EcoError.IntentSourceTargetConfigNotFound(call.target as string)
  }

  const tx = decodeFunctionData({
    abi: getERCAbi(targetConfig.contractType),
    data: call.data,
  })
  const selector = getFunctionBytes(call.data)
  const supportedSelectors = targetConfig.selectors.map((s) => toFunctionSelector(s))
  const supported = tx && includes(supportedSelectors, selector)
  if (!supported) {
    return null
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
    }) || intent.reward.nativeValue > 0
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
    id: Number(intent.route.source),
  })

  const dstChain = extractChain({
    chains: ChainsSupported,
    id: Number(intent.route.destination),
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
 * @param calls the calls to check
 * @returns
 */
export function getFunctionCalls(calls: CallDataInterface[]) {
  return calls.filter((call) => !isEmptyData(call.data))
}

/**
 * Iterates over the calls and returns those that have empty data and send native value
 * @param calls the calls to check
 * @returns
 */
export function getNativeCalls(calls: CallDataInterface[]) {
  return calls.filter((call) => call.value > 0 && isEmptyData(call.data))
}

/**
 * Iterates over the calls and returns the targets that do not have empty data
 * @param calls the calls to check
 * @returns
 */
export function getFunctionTargets(calls: CallDataInterface[]) {
  return getFunctionCalls(calls).map((call) => call.target)
}
