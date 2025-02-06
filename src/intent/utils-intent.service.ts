import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { Model } from 'mongoose'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Solver, TargetContract } from '../eco-configs/eco-config.types'
import { EcoError } from '../common/errors/eco-error'
import { includes } from 'lodash'
import { decodeFunctionData, DecodeFunctionDataReturnType, Hex, toFunctionSelector } from 'viem'
import { getERCAbi, CallDataInterface, getERC20Selector } from '../contracts'
import { getFunctionBytes } from '../common/viem/contracts'
import { FulfillmentLog } from '@/contracts/inbox'
import { Network } from 'alchemy-sdk'
import { ValidationChecks, ValidationIntentInterface } from '@/intent/validation.sevice'

/**
 * Data for a transaction target
 */
export interface TransactionTargetData {
  decodedFunctionData: DecodeFunctionDataReturnType
  selector: Hex
  targetConfig: TargetContract
}

/**
 * Type for logging in validations
 */
export interface IntentLogType {
  hash?: Hex
  sourceNetwork?: Network
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
  async updateInvalidIntentModel(model: IntentSourceModel, invalidCause: ValidationChecks) {
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
   * Decodes the function data for a target contract
   *
   * @param intent the intent model
   * @param solver the solver for the intent
   * @param target  the target address
   * @param data  the data to decode
   * @returns
   */
  getTransactionTargetData(
    intent: ValidationIntentInterface,
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
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `Selectors not supported for intent ${intent.hash ? intent.hash : 'quote'}`,
          properties: {
            unsupportedSelector: selector,
            source: intent.route.source,
            ...(intent.hash && {
              intentHash: intent.hash,
            }),
          },
        }),
      )
      return null
    }
    return { decodedFunctionData: tx, selector, targetConfig }
  }

  /**
   * Verifies that a target is of type erc20 and that the selector is supported
   * @param ttd the transaction target data
   * @param permittedSelector the selector to check against, if not provided it will check against all erc20 selectors
   * @returns
   */
  isERC20Target(ttd: TransactionTargetData | null, permittedSelector?: Hex): boolean {
    if (!ttd) {
      return false
    }
    const isERC20 = ttd.targetConfig.contractType === 'erc20'
    if (permittedSelector && ttd.selector !== permittedSelector) {
      return false
    }
    switch (ttd.selector) {
      case getERC20Selector('transfer'):
        const correctArgs =
          !!ttd.decodedFunctionData.args && ttd.decodedFunctionData.args.length === 2
        return isERC20 && correctArgs
      default:
        return false
    }
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

      const solver = await this.getSolver(model.intent.route.destination, {
        intentHash: intentHash,
        sourceNetwork: model.event.sourceNetwork,
      })
      if (!solver) {
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

  async getSolver(destination: bigint, opts?: any): Promise<Solver | undefined> {
    const solver = this.ecoConfigService.getSolver(destination)
    if (!solver) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `No solver found for chain ${destination}`,
          properties: {
            ...(opts ? opts : {}),
          },
        }),
      )
      return
    }
    return solver
  }
}
