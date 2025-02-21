import { Injectable, Logger } from '@nestjs/common'
import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import { encodeAbiParameters, encodeFunctionData, erc20Abi, Hex, pad, zeroAddress } from 'viem'
import { TransactionTargetData, UtilsIntentService } from './utils-intent.service'
import { getERC20Selector } from '../contracts'
import { EcoError } from '../common/errors/eco-error'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { Solver } from '../eco-configs/eco-config.types'
import { IntentSourceModel } from './schemas/intent-source.schema'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { ProofService } from '../prover/proof.service'
import { ExecuteSmartWalletArg } from '../transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { InboxAbi } from '@eco-foundation/routes-ts'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'

/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
@Injectable()
export class FulfillIntentService implements IFulfillService {
  private logger = new Logger(FulfillIntentService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly proofService: ProofService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
  ) {}

  /**
   * Processes and fulfills a specified intent based on its type.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
   * @return {Promise<void>} Returns the result of the fulfillment process based on the intent type.
   */
  async fulfillIntent(intentHash: Hex): Promise<unknown> {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}

    if (err) throw err
    if (!data || !model || !solver) return
    if (model.status === 'SOLVED') return

    const { type } = this.ecoConfigService.getFulfill()

    if (type === 'crowd-liquidity') {
      return this.executeFulfillIntentWithCL(model, solver)
    }

    // TODO: Move to external service
    return this.executeFulfillIntent(model, solver)
  }

  /**
   * Executes the fulfillment of an intent using crowd liquidity.
   *
   * @param {IntentSourceModel} model - The model representing the intent to be fulfilled.
   * @param {Solver} solver - The solver responsible for executing the fulfillment of the intent.
   * @return {Promise<void>} A promise that resolves when the intent fulfillment is successfully executed.
   */
  async executeFulfillIntentWithCL(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    if (this.crowdLiquidityService.isRouteSupported(model)) {
      try {
        return await this.crowdLiquidityService.executeFulfillIntent(model, solver)
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'Failed to fulfill using Crowd Liquidity, proceeding to use solver',
            properties: { intentHash: model.intent.hash },
            error,
          }),
        )
      }
    }

    // If crowd liquidity is not available for current route, or it failed to fulfill the intent
    // Fulfill the intent using the solver
    return this.executeFulfillIntent(model, solver)
  }

  /**
   * Executes the fulfill intent process for an intent. It creates the transaction for fulfillment, and posts it
   * to the chain. It then updates the db model of the intent with the status and receipt.
   *
   * @param {IntentSourceModel} model - The intent model containing details about the intent to be fulfilled.
   * @param {Solver} solver - The solver object used to determine the transaction executor and chain-specific configurations.
   * @return {Promise<void>} Resolves with no value. Throws an error if the intent fulfillment fails.
   */
  async executeFulfillIntent(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    const kernelAccountClient = await this.kernelAccountClientService.getClient(solver.chainID)

    // Create transactions for intent targets
    const targetSolveTxs = this.getTransactionsForTargets(model, solver)

    // Create fulfill tx
    const fulfillTx = await this.getFulfillIntentTx(solver.solverAddress, model)

    // Combine all transactions
    const transactions = [...targetSolveTxs, fulfillTx]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Fulfilling batch transaction`,
        properties: {
          batch: transactions,
        },
      }),
    )

    try {
      const transactionHash = await kernelAccountClient.execute(transactions)

      const receipt = await kernelAccountClient.waitForTransactionReceipt({ hash: transactionHash })

      // set the status and receipt for the model
      model.receipt = receipt as any
      if (receipt.status === 'reverted') {
        throw EcoError.FulfillIntentRevertError(receipt)
      }
      model.status = 'SOLVED'

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Fulfilled transactionHash ${receipt.transactionHash}`,
          properties: {
            userOPHash: receipt,
            destinationChainID: model.intent.destinationChainID,
            sourceChainID: model.event.sourceChainID,
          },
        }),
      )

      return transactionHash
    } catch (e) {
      model.status = 'FAILED'
      model.receipt = model.receipt ? { previous: model.receipt, current: e } : e

      this.logger.error(
        EcoLogMessage.withError({
          message: `fulfillIntent: Invalid transaction`,
          error: EcoError.FulfillIntentBatchError,
          properties: {
            model: model,
            flatExecuteData: transactions,
            errorPassed: e,
          },
        }),
      )

      // Throw error to retry job
      throw e
    } finally {
      // Update the db model
      await this.utilsIntentService.updateIntentModel(model)
    }
  }

  /**
   * Checks if the transaction is feasible for an erc20 token transfer.
   *
   * @param tt the transaction target data
   * @param solver the target solver
   * @param target the target ERC20 address
   * @returns
   */
  handleErc20(tt: TransactionTargetData, solver: Solver, target: Hex) {
    switch (tt.selector) {
      case getERC20Selector('transfer'):
        const dstAmount = tt.decodedFunctionData.args?.[1] as bigint

        const transferFunctionData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [solver.solverAddress, dstAmount],
        })

        return [{ to: target, data: transferFunctionData }]
      default:
        return []
    }
  }

  /**
   * Returns the fulfill intent data
   * @param inboxAddress
   * @param model
   * @private
   */
  private async getFulfillIntentTx(
    inboxAddress: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    const claimant = this.ecoConfigService.getEth().claimant

    // Storage Prover

    const isStorageProver = this.proofService.isStorageProver(model.intent.prover)
    if (isStorageProver) {
      return this.getFulfillTxForStorageProver(inboxAddress, claimant, model)
    }

    // Hyper Prover

    const isHyperlane = this.proofService.isHyperlaneProver(model.intent.prover)
    if (isHyperlane) {
      return this.getFulfillTxForHyperprover(inboxAddress, claimant, model)
    }

    throw new Error('Unsupported fulfillment method')
  }

  /**
   * Generates a transaction to fulfill an intent for a hyperprover based on the configuration.
   *
   * @param {Hex} inboxAddress - The address of the inbox associated with the transaction.
   * @param {Hex} claimant - The address of the claimant requesting fulfillment.
   * @param {IntentSourceModel} model - The model containing the details of the intent to fulfill.
   * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to the transaction arguments needed to fulfill the intent.
   */
  private async getFulfillTxForHyperprover(
    inboxAddress: Hex,
    claimant: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    switch (this.ecoConfigService.getFulfill().run) {
      case 'batch':
        return this.getFulfillTxForHyperproverBatch(inboxAddress, claimant, model)
      case 'single':
      default:
        return this.getFulfillTxForHyperproverSingle(inboxAddress, claimant, model)
    }
  }

  /**
   * Generates transactions for specified intent targets by processing the intent source model and solver.
   *
   * @param {IntentSourceModel} model - The intent source model containing call data and routing information.
   * @param {Solver} solver - The solver instance used to resolve transaction target data and relevant configurations.
   * @return {Array} An array of generated transactions based on the intent targets. Returns an empty array if no valid transactions are created.
   */
  private getTransactionsForTargets(model: IntentSourceModel, solver: Solver) {
    // Create transactions for intent targets
    return model.intent.targets.flatMap((target, index) => {
      const tt = this.utilsIntentService.getTransactionTargetData(
        model,
        solver,
        target,
        model.intent.data[index],
      )
      if (tt === null) {
        this.logger.error(
          EcoLogMessage.withError({
            message: `fulfillIntent: Invalid transaction data`,
            error: EcoError.FulfillIntentNoTransactionError,
            properties: {
              model: model,
            },
          }),
        )
        return []
      }

      switch (tt.targetConfig.contractType) {
        case 'erc20':
          return this.handleErc20(tt, solver, target)
        case 'erc721':
        case 'erc1155':
        default:
          return []
      }
    })
  }

  /**
   * Constructs a transaction argument for fulfilling a hyper-prover batched intent.
   *
   * @param {Hex} inboxAddress - The address of the inbox contract.
   * @param {Hex} claimant - The address of the entity claiming the intent.
   * @param {IntentSourceModel} model - The intent source model containing the intent, route, and related data.
   * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to an object containing the transaction data for executing the smart wallet.
   */
  private async getFulfillTxForHyperproverBatch(
    inboxAddress: Hex,
    claimant: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfillHyperBatched',
      args: [
        model.event.sourceChainID,
        model.intent.targets,
        model.intent.data,
        model.intent.expiryTime,
        model.intent.nonce,
        claimant,
        model.intent.hash,
        model.intent.prover,
      ],
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      value: 0n,
    }
  }

  private async getFulfillTxForHyperproverSingle(
    inboxAddress: Hex,
    claimant: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    const fee = await this.getHyperlaneFee(inboxAddress, model)

    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfillHyperInstantWithRelayer',
      args: [
        model.event.sourceChainID,
        model.intent.targets,
        model.intent.data,
        model.intent.expiryTime,
        model.intent.nonce,
        claimant,
        model.intent.hash,
        model.intent.prover,
        '0x0',
        zeroAddress,
      ],
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      value: fee,
    }
  }

  private async getFulfillTxForStorageProver(
    inboxAddress: Hex,
    claimant: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfillStorage',
      args: [
        model.event.sourceChainID,
        model.intent.targets,
        model.intent.data,
        model.intent.expiryTime,
        model.intent.nonce,
        claimant,
        model.intent.hash,
      ],
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      value: 0n,
    }
  }

  /**
   * Calculates the fee required for a hyperlane transaction by calling the inbox contract.
   *
   * @param {Hex} solverAddress - The address of the inbox smart contract.
   * @param {IntentSourceModel} model - The model containing intent details, including route, hash, and reward information.
   * @return {Promise<Hex | undefined>} A promise that resolves to the fee in hexadecimal format, or undefined if the fee could not be determined.
   */
  private async getHyperlaneFee(solverAddress: Hex, model: IntentSourceModel): Promise<bigint> {
    const client = await this.kernelAccountClientService.getClient(
      Number(model.intent.destinationChainID),
    )
    const encodedMessageBody = encodeAbiParameters(
      [{ type: 'bytes[]' }, { type: 'address[]' }],
      [[model.intent.hash], [this.ecoConfigService.getEth().claimant]],
    )
    const callData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fetchFee',
      args: [
        model.event.sourceChainID, //_sourceChainID
        pad(model.intent.prover), //_prover
        encodedMessageBody, //_messageBody
        '0x0', //_metadata
        zeroAddress, //_postDispatchHook
      ],
    })

    const proverData = await client.call({
      to: solverAddress,
      data: callData,
    })
    return BigInt(proverData.data ?? 0)
  }
}
