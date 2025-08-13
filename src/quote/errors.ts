import { EcoError } from '@/common/errors/eco-error'
import { FeeAlgorithm } from '@/eco-configs/eco-config.types'
import { ValidationChecks } from '@/intent/validation.sevice'
import { Hex } from 'viem'
import { NormalizedTotal } from '@/fee/types'
import { formatNormalizedTotal } from '@/fee/utils'

/**
 * Errors that can be thrown by the quote service
 */
export interface QuoteErrorsInterface {
  statusCode: number
  message: string
  code: number

  [key: string]: any
}

export type Quote400 = QuoteErrorsInterface & {
  statusCode: 400
}

export type Quote500 = QuoteErrorsInterface & {
  statusCode: 500
}

// The solver does not supoort the request prover
export const ProverUnsupported: Quote400 = {
  statusCode: 400,
  message: 'Bad Request: The prover selected is not supported.',
  code: 1,
}

// The quote does not have a reward structure that would be accepted by solver
export const RewardInvalid: Quote400 = {
  statusCode: 400,
  message: "Bad Request: The reward structure is invalid. Solver doesn't accept the reward.",
  code: 2,
}

// The quote does not support some of the callData
export const CallsUnsupported: Quote400 = {
  statusCode: 400,
  message: 'Bad Request: Some callData in calls are not supported.',
  code: 3,
}

// The quote does not support some of the callData
export const SolverUnsupported: Quote400 = {
  statusCode: 400,
  message: "Bad Request: The solver doesn't support that chain.",
  code: 4,
}

// The quote intent is deemed invalid by the validation service
export function InvalidQuoteIntent(validations: ValidationChecks): Quote400 {
  return {
    statusCode: 400,
    message: 'Bad Request: The quote was deemed invalid.',
    code: 4,
    properties: {
      validations,
    },
  }
}

/**
 * The quote intent cannot be fulfilled because it doesn't have a
 * reward hight enough to cover the ask
 *
 * @param totalAsk the total amount of the ask
 * @param totalFulfillment
 * @returns
 */
export function InsufficientBalance(
  totalAsk: NormalizedTotal,
  totalFulfillment: NormalizedTotal,
): Quote400 {
  return {
    statusCode: 400,
    message:
      'Bad Request: The quote intent balance was insufficient for fulfillment. TotalAsk > TotalFulfillmentAmount',
    code: 5,
    properties: {
      totalAsk,
      totalFulfillment,
    },
  }
}

// The quote is deemed infeasible by the feasibility service
export function InfeasibleQuote(error: Error): Quote400 {
  return {
    statusCode: 400,
    message: 'Bad Request: The quote was deemed infeasible.',
    code: 6,
    error,
  }
}

// The quote is deemed invalid by the feasibility service
export function InvalidQuote(
  results: (
    | false
    | {
        solvent: boolean
        profitable: boolean
      }
    | undefined
  )[],
): Quote400 {
  return {
    statusCode: 400,
    message: 'Bad Request: The quote was deemed invalid.',
    code: 7,
    results,
  }
}

// The quote is deemed to be insolvent or unprofitable by the feasibility service
export function InsolventUnprofitableQuote(
  results: (
    | false
    | {
        solvent: boolean
        profitable: boolean
      }
    | undefined
  )[],
): Quote400 {
  return {
    statusCode: 400,
    message: 'Bad Request: The quote was deemed to be insolvent or unprofitable.',
    code: 8,
    results,
  }
}

/////////////

/**
 * The server failed to save to db
 * @param error  the error that was thrown
 * @returns
 */
export function InternalSaveError(error: Error): Quote500 {
  return {
    statusCode: 500,
    message: 'Internal Server Error: Failed to save quote intent.',
    code: 1,
    error,
  }
}

/**
 * The server failed to generate the quote
 * @returns
 */
export function InternalQuoteError(error?: Error): Quote500 {
  return {
    statusCode: 500,
    message: `Internal Server Error: Failed generate quote. ${error?.toString()}`,
    code: 2,
    error,
  }
}

export class QuoteError extends Error {
  static InvalidSolverAlgorithm(destination: bigint, algorithm: FeeAlgorithm) {
    return new EcoError(
      `The solver for destination chain ${destination} did not return a valid algorithm : ${algorithm} `,
    )
  }

  static NoSolverForDestination(destination: bigint) {
    return new EcoError(`No solver found for destination chain ${destination}`)
  }

  static NoIntentSourceForSource(source: bigint) {
    return new EcoError(`No intent source found for source chain ${source}`)
  }

  static NoIntentSourceForDestination(destination: bigint) {
    return new EcoError(`No intent source found for destination chain ${destination}`)
  }

  static FetchingRewardTokensFailed(chainID: bigint) {
    return new EcoError(`Error occured when fetching reward tokens for ${chainID}`)
  }

  static FetchingCallTokensFailed(chainID: bigint) {
    return new EcoError(`Error occured when fetching call tokens for ${chainID}`)
  }

  static NonERC20TargetInCalls() {
    return new EcoError(`One or more targets not erc20s`)
  }

  static SolverLacksLiquidity(
    chainID: number,
    target: Hex,
    requested: bigint,
    available: bigint,
    normMinBalance: bigint,
  ) {
    return new EcoError(
      `The solver on chain ${chainID} lacks liquidity for ${target} requested ${requested} available ${available} with a normMinBalance of ${normMinBalance}`,
    )
  }

  static RouteIsInfeasable(ask: NormalizedTotal, reward: NormalizedTotal) {
    return new EcoError(
      `The route is not infeasable: the reward ${formatNormalizedTotal(reward)} is less than the ask ${formatNormalizedTotal(ask)}`,
    )
  }

  static RewardIsInfeasable(fee: NormalizedTotal, reward: NormalizedTotal) {
    return new EcoError(
      `The reward is infeasable: the reward ${formatNormalizedTotal(reward)} is less than the fee ${formatNormalizedTotal(fee)}`,
    )
  }

  static MultiFulfillRoute() {
    return new EcoError(`A route with more than 1 erc20 target is not supported`)
  }

  static DuplicatedRewardToken() {
    return new EcoError(`A route with duplicated reward tokens is not supported`)
  }

  static FailedToFetchTarget(chainID: bigint, target: Hex) {
    return new EcoError(
      `Cannot resolve the decimals of a call target ${target} on chain ${chainID}`,
    )
  }

  static RewardTokenNotFound(address: Hex) {
    return new EcoError(`Reward token ${address} not found in quote reward tokens`)
  }

  static RouteTokenNotFound(address: Hex) {
    return new EcoError(`Route token ${address} not found in quote route tokens`)
  }

  static InvalidFunctionData(target: Hex) {
    return new EcoError(`Invalid function data for target ${target}: missing or invalid args`)
  }
}
