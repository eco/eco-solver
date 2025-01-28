import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { ProofService } from '@/prover/proof.service'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { DeepOmit } from '@/utils/types'
import { Injectable, Logger } from '@nestjs/common'
import { difference } from 'lodash'
import { Hex, Prettify } from 'viem'

/**
 * Validation type that mixes the QuoteIntentDataDTO with the hash. This is used to
 * merge quotes and intents validations
 */
export type ValidationIntentModel = Prettify<
  DeepOmit<QuoteIntentDataDTO, 'tokens'> & { hash?: Hex }
>

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly proofService: ProofService,
  ) {}

  /**
   * Executes all the validations we have on the model and solver
   *
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns true if they all pass, false otherwise
   */
  async assertValidations(
    model: ValidationIntentModel,
    solver: Solver,
  ): Promise<{
    proverUnsupported: boolean
    targetsUnsupported: boolean
    selectorsUnsupported: boolean
    expiresEarly: boolean
    invalidDestination: boolean
    sameChainFulfill: boolean
  }> {
    const proverUnsupported = !this.supportedProver({
      sourceChainID: model.route.source,
      prover: model.reward.prover,
    })
    const targetsUnsupported = !this.supportedTargets(model, solver)
    const selectorsUnsupported = !this.supportedSelectors(model, solver)
    const expiresEarly = !this.validExpirationTime(model)
    const invalidDestination = !this.validDestination(model)
    const sameChainFulfill = !this.fulfillOnDifferentChain(model)

    return {
      proverUnsupported,
      targetsUnsupported,
      selectorsUnsupported,
      expiresEarly,
      invalidDestination,
      sameChainFulfill,
    }
  }

  /**
   * Checks if the IntentCreated event is using a supported prover. It first finds the source intent contract that is on the
   * source chain of the event. Then it checks if the prover is supported by the source intent. In the
   * case that there are multiple matching source intent contracts on the same chain, as long as any of
   * them support the prover, the function will return true.
   *
   * @param model the source intent model
   * @returns
   */
  supportedProver(model: { sourceChainID: bigint; prover: Hex }): boolean {
    const srcSolvers = this.ecoConfigService.getIntentSources().filter((intent) => {
      return BigInt(intent.chainID) == model.sourceChainID
    })

    return srcSolvers.some((intent) => {
      return intent.provers.some((prover) => prover == model.prover)
    })
  }

  /**
   * Verifies that the intent targets and data arrays are equal in length, and
   * that every target-data can be decoded
   *
   * @param model the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedSelectors(model: ValidationIntentModel, solver: Solver): boolean {
    if (model.route.calls.length == 0) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `supportedSelectors: Target/data invalid`,
        }),
      )
      return false
    }
    return model.route.calls.every((call) => {
      const tx = this.utilsIntentService.getTransactionTargetData(model, solver, call)
      return tx
    })
  }

  /**
   * Verifies that all the intent targets are supported by the solver
   *
   * @param model the intent model
   * @param solver the solver for the intent
   * @returns
   */
  supportedTargets(model: ValidationIntentModel, solver: Solver): boolean {
    const modelTargets = model.route.calls.map((call) => call.target)
    const solverTargets = Object.keys(solver.targets)
    //all targets are included in the solver targets array
    const exist = solverTargets.length > 0 && modelTargets.length > 0
    const targetsSupported = exist && difference(modelTargets, solverTargets).length == 0

    if (!targetsSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Targets not supported for intent ${model.hash ? model.hash : 'quote'}`,
          properties: {
            ...(model.hash && {
              intentHash: model.hash,
              source: model.route.source,
            }),
          },
        }),
      )
    }
    return targetsSupported
  }

  /**
   *
   * @param model the source intent model
   * @param solver the solver for the source chain
   * @returns
   */
  validExpirationTime(model: ValidationIntentModel): boolean {
    //convert to milliseconds
    const time = Number.parseInt(`${model.reward.deadline as bigint}`) * 1000
    const expires = new Date(time)
    return !!this.proofService.isIntentExpirationWithinProofMinimumDate(
      model.reward.prover,
      expires,
    )
  }

  /**
   * Checks that the intent destination is supported by the solver
   * @param model the source intent model
   * @returns
   */
  validDestination(model: ValidationIntentModel): boolean {
    return this.ecoConfigService.getSupportedChains().includes(model.route.destination)
  }

  /**
   * Checks that the intent fulfillment is on a different chain than its source
   * Needed since some proving methods(Hyperlane) cant prove same chain
   * @param model the model of the source intent
   * @param solver the solver used to fulfill
   * @returns
   */
  fulfillOnDifferentChain(model: ValidationIntentModel): boolean {
    return model.route.destination !== model.route.source
  }
}
