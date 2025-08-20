import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { Model } from 'mongoose'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Solver, TargetContract } from '../eco-configs/eco-config.types'
import { EcoError } from '../common/errors/eco-error'
import { DecodeFunctionDataReturnType } from 'viem'
import { Hex } from 'viem'
import { FulfillmentLog } from '@eco-solver/contracts/inbox'
import { Network } from '@eco-solver/common/alchemy/network'
import { ValidationChecks } from '@eco-solver/intent/validation.sevice'
import { EcoAnalyticsService } from '@eco-solver/analytics'

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
 * Service class for solving an intent on chain
 */
@Injectable()
export class UtilsIntentService {
  private logger = new Logger(UtilsIntentService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
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
    this.ecoAnalytics.trackIntentStatusUpdate(model, 'INVALID', invalidCause)

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
  async updateInfeasableIntentModel(model: IntentSourceModel, infeasable: Error) {
    this.ecoAnalytics.trackIntentStatusUpdate(model, 'INFEASABLE', infeasable)

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
    try {
      const model = await this.intentModel.findOne({
        'intent.hash': fulfillment.args._hash,
      })

      if (model) {
        model.status = 'SOLVED'
        await this.intentModel.updateOne({ 'intent.hash': fulfillment.args._hash }, model)
        this.ecoAnalytics.trackFulfillmentProcessingSuccess(fulfillment, model)
      } else {
        this.ecoAnalytics.trackFulfillmentProcessingIntentNotFound(fulfillment)
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `Intent not found for fulfillment ${fulfillment.args._hash}`,
            properties: {
              fulfillment,
            },
          }),
        )
      }
    } catch (error) {
      this.ecoAnalytics.trackFulfillmentProcessingError(fulfillment, error)
      throw error
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
        const error = EcoError.IntentSourceDataNotFound(intentHash)
        this.ecoAnalytics.trackIntentProcessDataRetrievalModelNotFound(intentHash, error)
        return { model, solver: null, err: error }
      }

      const solver = await this.getSolver(model.intent.route.destination, {
        intentHash: intentHash,
        sourceNetwork: IntentSourceModel.getSource(model),
      })

      if (!solver) {
        this.ecoAnalytics.trackIntentProcessDataRetrievalSolverNotFound(intentHash, model)
        return
      }

      this.ecoAnalytics.trackIntentProcessDataRetrievalSuccess(intentHash, model, solver)
      return { model, solver }
    } catch (e) {
      this.ecoAnalytics.trackIntentProcessDataRetrievalError(intentHash, e)
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
      this.ecoAnalytics.trackSolverResolutionNotFound(destination, opts)
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

    this.ecoAnalytics.trackSolverResolutionSuccess(destination, solver, opts)
    return solver
  }
}
