import { ValidationChecks } from '@/intent/validation.sevice'

/**
 * Errors that can be thrown by the quote service
 */
export class QuoteErrors {}
export type Quote400 = {
  statusCode: 400
  message: string
  code: number
  [key: string]: any
}

export type Quote500 = {
  statusCode: 500
  message: string
  code: number
  [key: string]: any
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
 * @param totalRewardAmount the total amount of the reward
 * @returns
 */
export function InsufficientBalance(totalAsk: bigint, totalFulfillmentAmount: bigint): Quote400 {
  return {
    statusCode: 400,
    message:
      'Bad Request: The quote intent balance was insufficient for fulfillment. TotalAsk > TotalFulfillmentAmount',
    code: 5,
    properties: {
      totalAsk,
      totalFulfillmentAmount,
    },
  }
}

// The quote is deemed infeasible by the feasibility service
export function InfeasibleQuote(
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
    message: 'Bad Request: The quote was deemed infeasible.',
    code: 6,
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
export function InternalQuoteError(): Quote500 {
  return {
    statusCode: 500,
    message: 'Internal Server Error: Failed generate quote.',
    code: 2,
  }
}
