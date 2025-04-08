import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { FeeService } from '@/fee/fee.service'
import { getTransactionTargetData } from '@/intent/utils'
import { ProofService } from '@/prover/proof.service'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { Injectable, Logger } from '@nestjs/common'
import { difference } from 'lodash'
import { Hex } from 'viem'

interface IntentModelWithHashInterface {
  hash?: Hex
}

/**
 * Validation type that mixes the QuoteIntentDataDTO with the hash. This is used to
 * merge quotes and intents validations
 */
export interface ValidationIntentInterface
  extends QuoteIntentDataInterface,
    IntentModelWithHashInterface {}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationChecks = {
  supportedProver: boolean
  supportedTargets: boolean
  supportedSelectors: boolean
  validTransferLimit: boolean
  validExpirationTime: boolean
  validDestination: boolean
  fulfillOnDifferentChain: boolean
}

/**
 * Validates that all of the validations succeeded
 * @param validations  the validations to check
 * @returns true if all of the validations passed
 */
export function validationsSucceeded(validations: ValidationType): boolean {
  return Object.values(validations).every((v) => v)
}

/**
 * Checks that at least one of the validations failed
 * @param validations the validations to check
 * @returns true if any of the validations failed
 */
export function validationsFailed(validations: ValidationType): boolean {
  return !validationsSucceeded(validations)
}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationType = {
  [key: string]: boolean
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name)

  constructor(
    private readonly proofService: ProofService,
    private readonly feeService: FeeService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Executes all the validations we have on the model and solver
   *
   * @param intent the source intent model
   * @param solver the solver for the source chain
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(
    intent: ValidationIntentInterface,
    solver: Solver,
    isReverseQuote: boolean = false,
  ): Promise<ValidationChecks> {
    const supportedProver = this.supportedProver({
      sourceChainID: intent.route.source,
      prover: intent.reward.prover,
    })
    const supportedTargets = this.supportedTargets(intent, solver)
    const supportedSelectors = this.supportedSelectors(intent, solver, isReverseQuote)
    const validTransferLimit = await this.validTransferLimit(intent)
    const validExpirationTime = this.validExpirationTime(intent)
    const validDestination = this.validDestination(intent)
    const fulfillOnDifferentChain = this.fulfillOnDifferentChain(intent)

    return {
      supportedProver,
      supportedTargets,
      supportedSelectors,
      validTransferLimit,
      validExpirationTime,
      validDestination,
      fulfillOnDifferentChain,
    }
  }

  /**
   * Checks if the IntentCreated event is using a supported prover. It first finds the source intent contract that is on the
   * source chain of the event. Then it checks if the prover is supported by the source intent. In the
   * case that there are multiple matching source intent contracts on the same chain, as long as any of
   * them support the prover, the function will return true.
   *
   * @param ops the intent info
   * @returns
   */
  supportedProver(ops: { sourceChainID: bigint; prover: Hex }): boolean {
    const srcSolvers = this.ecoConfigService.getIntentSources().filter((intent) => {
      return BigInt(intent.chainID) == ops.sourceChainID
    })

    return srcSolvers.some((intent) => {
      return intent.provers.some((prover) => prover == ops.prover)
    })
  }

  /**
   * Verifies that the intent targets and data arrays are equal in length, and
   * that every target-data can be decoded
   *
   * @param intent the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedSelectors(
    intent: ValidationIntentInterface,
    solver: Solver,
    isReverseQuote: boolean = false,
  ): boolean {
    if (intent.route.calls.length == 0) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `supportedSelectors: Target/data invalid`,
        }),
      )
      return false
    }
    return intent.route.calls.every((call) => {
      const tx = getTransactionTargetData(solver, call)
      if (isReverseQuote) {
        return tx && tx.decodedFunctionData.functionName === 'transfer'
      }
      return tx
    })
  }

  /**
   * Verifies that all the intent targets are supported by the solver
   *
   * @param intent the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedTargets(intent: ValidationIntentInterface, solver: Solver): boolean {
    const intentTargets = intent.route.calls.map((call) => call.target)
    const solverTargets = Object.keys(solver.targets)
    //all targets are included in the solver targets array
    const exist = solverTargets.length > 0 && intentTargets.length > 0
    const targetsSupported = exist && difference(intentTargets, solverTargets).length == 0

    if (!targetsSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Targets not supported for intent ${intent.hash ? intent.hash : 'quote'}`,
          properties: {
            ...(intent.hash && {
              intentHash: intent.hash,
              source: intent.route.source,
            }),
          },
        }),
      )
    }
    return targetsSupported
  }

  /**
   * Checks if the transfer total is within the bounds of the solver, ie below a certain threshold
   * @param intent the source intent model
   * @returns  true if the transfer is within the bounds
   */
  async validTransferLimit(intent: ValidationIntentInterface): Promise<boolean> {
    const { totalFillNormalized, error } = await this.feeService.getTotalFill(intent)
    if (error) {
      return false
    }
    const limitFillBase6 = this.feeService.getFeeConfig({ intent }).limitFillBase6
    return totalFillNormalized <= limitFillBase6
  }

  /**
   *
   * @param intent the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  validExpirationTime(intent: ValidationIntentInterface): boolean {
    //convert to milliseconds
    const time = Number.parseInt(`${intent.reward.deadline as bigint}`) * 1000
    const expires = new Date(time)
    return this.proofService.isIntentExpirationWithinProofMinimumDate(intent.reward.prover, expires)
  }

  /**
   * Checks that the intent destination is supported by the solver
   * @param intent the source intent model
   * @returns
   */
  validDestination(intent: ValidationIntentInterface): boolean {
    return this.ecoConfigService.getSupportedChains().includes(intent.route.destination)
  }

  /**
   * Checks that the intent fulfillment is on a different chain than its source
   * Needed since some proving methods(Hyperlane) cant prove same chain
   * @param intent the source intent
   * @param solver the solver used to fulfill
   * @returns
   */
  fulfillOnDifferentChain(intent: ValidationIntentInterface): boolean {
    return intent.route.destination !== intent.route.source
  }
}
