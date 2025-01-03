import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { Model } from 'mongoose'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Solver, TargetContract } from '../eco-configs/eco-config.types'
import { EcoError } from '../common/errors/eco-error'
import { difference, includes } from 'lodash'
import { decodeFunctionData, DecodeFunctionDataReturnType, Hex, toFunctionSelector } from 'viem'
import { getERCAbi } from '../contracts'
import { getFunctionBytes } from '../common/viem/contracts'
import { FulfillmentLog } from '@/contracts/inbox'

/**
 * Data for a transaction target
 */
export interface TransactionTargetData {
  decodedFunctionData: DecodeFunctionDataReturnType
  selector: Hex
  targetConfig: TargetContract
}

/**
 * Model and solver for the intent
 */
export interface IntentProcessData {
  model: IntentSourceModel | null
  solver: Solver | null
  err?: EcoError
}

/**
 * Infeasable result type
 */
type InfeasableResult = (
  | false
  | {
      solvent: boolean
      profitable: boolean
    }
  | undefined
)[]

/**
 * Service class for solving an intent on chain
 */
@Injectable()
export class UtilsIntentService {
  private logger = new Logger(UtilsIntentService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * updateOne the intent model in the database, using the intent hash as the query
   *
   * @param intentModel the model factory to use
   * @param model the new model data
   */
  async updateIntentModel(model: IntentSourceModel) {
    return await this.intentModel.updateOne({ 'intent.hash': model.intent.hash }, model)
  }

  /**
   * Updates the intent model with the invalid cause, using {@link updateIntentModel}
   *
   * @param intentModel the model factory to use
   * @param model the new model data
   * @param invalidCause the reason the intent is invalid
   * @returns
   */
  async updateInvalidIntentModel(
    model: IntentSourceModel,
    invalidCause: {
      proverUnsupported: boolean
      targetsUnsupported: boolean
      selectorsUnsupported: boolean
      expiresEarly: boolean
    },
  ) {
    model.status = 'INVALID'
    model.receipt = invalidCause as any
    return await this.updateIntentModel(model)
  }

  /**
   * Updates the intent model with the infeasable cause and receipt, using {@link updateIntentModel}
   *
   * @param intentModel  the model factory to use
   * @param model  the new model data
   * @param infeasable  the infeasable result
   * @returns
   */
  async updateInfeasableIntentModel(model: IntentSourceModel, infeasable: InfeasableResult) {
    model.status = 'INFEASABLE'
    model.receipt = infeasable as any
    return await this.updateIntentModel(model)
  }

  /**
   * Updates the intent model with the fulfillment status. If the intent was fulfilled by this solver, then
   * the status should already be SOLVED: in that case this function does nothing.
   *
   * @param fulfillment the fulfillment log event
   */
  async updateOnFulfillment(fulfillment: FulfillmentLog) {
    const model = await this.intentModel.findOne({
      'intent.hash': fulfillment.args._hash,
    })
    if (model) {
      model.status = 'SOLVED'
      await this.intentModel.updateOne({ 'intent.hash': fulfillment.args._hash }, model)
    } else {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `Intent not found for fulfillment ${fulfillment.args._hash}`,
          properties: {
            fulfillment,
          },
        }),
      )
    }
  }

  /**
   * Verifies that the intent targets and data arrays are equal in length, and
   * that every target-data can be decoded
   *
   * @param model the intent model
   * @param solver the solver for the intent
   * @returns
   */
  selectorsSupported(model: IntentSourceModel, solver: Solver): boolean {
    if (
      model.intent.targets.length !== model.intent.data.length ||
      model.intent.targets.length == 0
    ) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `validateIntent: Target/data invalid`,
          properties: {
            intent: model.intent,
          },
        }),
      )
      return false
    }
    return model.intent.targets.every((target, index) => {
      const tx = this.getTransactionTargetData(model, solver, target, model.intent.data[index])
      return tx
    })
  }

  /**
   * Decodes the function data for a target contract
   *
   * @param model the intent model
   * @param solver the solver for the intent
   * @param target  the target address
   * @param data  the data to decode
   * @returns
   */
  getTransactionTargetData(
    model: IntentSourceModel,
    solver: Solver,
    target: Hex,
    data: Hex,
  ): TransactionTargetData | null {
    const targetConfig = solver.targets[target as string] as TargetContract
    if (!targetConfig) {
      //shouldn't happen since we do this.targetsSupported(model, solver) before this call
      throw EcoError.IntentSourceTargetConfigNotFound(target as string)
    }

    const tx = decodeFunctionData({
      abi: getERCAbi(targetConfig.contractType),
      data,
    })
    const selector = getFunctionBytes(data)
    const supportedSelectors = targetConfig.selectors.map((s) => toFunctionSelector(s))
    const supported = tx && includes(supportedSelectors, selector)
    if (!supported) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Selectors not supported for intent ${model.intent.hash}`,
          properties: {
            intentHash: model.intent.hash,
            sourceNetwork: model.event.sourceNetwork,
            unsupportedSelector: selector,
          },
        }),
      )
      return null
    }
    return { decodedFunctionData: tx, selector, targetConfig }
  }

  /**
   * Verifies that all the intent targets are supported by the solver
   *
   * @param model the intent model
   * @param solver the solver for the intent
   * @returns
   */
  targetsSupported(model: IntentSourceModel, solver: Solver): boolean {
    const modelTargets = model.intent.targets
    const solverTargets = Object.keys(solver.targets)
    //all targets are included in the solver targets array
    const exist = solverTargets.length > 0 && modelTargets.length > 0
    const targetsSupported = exist && difference(modelTargets, solverTargets).length == 0

    if (!targetsSupported) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Targets not supported for intent ${model.intent.hash}`,
          properties: {
            intentHash: model.intent.hash,
            sourceNetwork: model.event.sourceNetwork,
          },
        }),
      )
    }
    return targetsSupported
  }

  /**
   * Finds the the intent model in the database by the intent hash and the solver that can fulfill
   * on the destination chain for that intent
   *
   * @param intentHash the intent hash
   * @returns Intent model and solver
   */
  async getIntentProcessData(intentHash: string): Promise<IntentProcessData | undefined> {
    try {
      const model = await this.intentModel.findOne({
        'intent.hash': intentHash,
      })
      if (!model) {
        return { model, solver: null, err: EcoError.IntentSourceDataNotFound(intentHash) }
      }

      const solver = this.ecoConfigService.getSolver(model.intent.destinationChainID)
      if (!solver) {
        this.logger.log(
          EcoLogMessage.fromDefault({
            message: `No solver found for chain ${model.intent.destinationChainID}`,
            properties: {
              intentHash: intentHash,
              sourceNetwork: model.event.sourceNetwork,
            },
          }),
        )
        return
      }
      return { model, solver }
    } catch (e) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Error in getIntentProcessData ${intentHash}`,
          properties: {
            intentHash: intentHash,
            error: e,
          },
        }),
      )
      return
    }
  }
}
