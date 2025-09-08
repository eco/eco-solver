import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { Model } from 'mongoose'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Solver, TargetContract } from '../eco-configs/eco-config.types'
import { EcoError } from '../common/errors/eco-error'
import { DecodeFunctionDataReturnType, Hex } from 'viem'
import { FulfillmentLog } from '@/contracts/inbox'
import { Network } from '@/common/alchemy/network'
import { ValidationChecks } from '@/intent/validation.sevice'
import { EcoAnalyticsService } from '@/analytics'

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
  private logger = new IntentOperationLogger('UtilsIntentService')

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
  @LogOperation('intent_status_update', IntentOperationLogger)
  async updateInvalidIntentModel(
    @LogContext model: IntentSourceModel,
    @LogContext invalidCause: ValidationChecks,
  ) {
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
  @LogOperation('intent_status_update', IntentOperationLogger)
  async updateInfeasableIntentModel(
    @LogContext model: IntentSourceModel,
    @LogContext infeasable: Error,
  ) {
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
  @LogOperation('fulfillment_processing', IntentOperationLogger)
  async updateOnFulfillment(@LogContext fulfillment: FulfillmentLog) {
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
        // Log fulfillment warning using business event method
        this.logger.logFulfillmentProcessingIntentNotFound(
          fulfillment.args._hash,
          'intent_not_found_in_database',
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
  @LogOperation('intent_process_data_retrieval', IntentOperationLogger)
  async getIntentProcessData(
    @LogContext intentHash: string,
  ): Promise<IntentProcessData | undefined> {
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
      // Log process data retrieval error using business event method
      this.logger.logProcessDataRetrievalError(intentHash, e as Error, 'intent_process_data')
      return
    }
  }

  @LogOperation('solver_resolution', IntentOperationLogger)
  async getSolver(
    @LogContext destination: bigint,
    @LogContext opts?: any,
  ): Promise<Solver | undefined> {
    const solver = this.ecoConfigService.getSolver(destination)
    if (!solver) {
      this.ecoAnalytics.trackSolverResolutionNotFound(destination, opts)
      // Log solver resolution failure using business event method
      this.logger.logSolverResolutionResult(destination.toString(), null, false, 'no_solver_found')
      return
    }

    this.ecoAnalytics.trackSolverResolutionSuccess(destination, solver, opts)
    return solver
  }
}
