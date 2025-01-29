import { ValidationChecks } from '@/intent/validation.sevice'

export type Quote400 = {
  statusCode: 400
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

// The quote is deemed invalid by the validation service
export function InvalidQuote(validations: ValidationChecks): Quote400 {
  return {
    statusCode: 400,
    message: 'Bad Request: The quote was deemed invalid.',
    code: 4,
    validations,
  }
}
