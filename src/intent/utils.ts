import { EcoError } from '@/common/errors/eco-error'
import { getFunctionBytes } from '@/common/viem/contracts'
import { CallDataInterface, getERCAbi } from '@/contracts'
import { Solver, TargetContract } from '@/eco-configs/eco-config.types'
import { TransactionTargetData } from '@/intent/utils-intent.service'
import { includes } from 'lodash'
import { decodeFunctionData, toFunctionSelector } from 'viem'
import { mainnet } from 'viem/chains'

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
