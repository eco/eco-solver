import { Injectable, Logger } from '@nestjs/common'
import { encodeAbiParameters, encodeFunctionData, erc20Abi, Hex, pad, zeroAddress } from 'viem'
import { InboxAbi } from '@eco-foundation/routes-ts'
import { TransactionTargetData, UtilsIntentService } from './utils-intent.service'
import { getERC20Selector } from '@/contracts'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeService } from '@/fee/fee.service'
import { ProofService } from '@/prover/proof.service'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { getTransactionTargetData } from '@/intent/utils'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { RewardDataModel } from '@/intent/schemas/reward-data.schema'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'

/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
@Injectable()
export class WalletFulfillService implements IFulfillService {
  private logger = new Logger(WalletFulfillService.name)

  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly proofService: ProofService,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Executes the fulfill intent process for an intent. It creates the transaction for fulfillment, and posts it
   * to the chain. It then updates the db model of the intent with the status and receipt.
   *
   * @param {IntentSourceModel} model - The intent model containing details about the intent to be fulfilled.
   * @param {Solver} solver - The solver object used to determine the transaction executor and chain-specific configurations.
   * @return {Promise<void>} Resolves with no value. Throws an error if the intent fulfillment fails.
   */
  async fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    const kernelAccountClient = await this.kernelAccountClientService.getClient(solver.chainID)

    // Create transactions for intent targets
    const targetSolveTxs = this.getTransactionsForTargets(model, solver)

    // Create fulfill tx
    const fulfillTx = await this.getFulfillIntentTx(solver.inboxAddress, model)

    // Combine all transactions
    const transactions = [...targetSolveTxs, fulfillTx]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Fulfilling transaction`,
        properties: { transactions },
      }),
    )

    try {
      await this.finalFeasibilityCheck(model.intent)

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
            destinationChainID: model.intent.route.destination,
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
   * Checks that the intent is feasible for the fulfillment. This
   * could occur due to changes to the fees/limits of the intent. A failed
   * intent might retry later when its no longer profitable, etc.
   * Throws an error if the intent is not feasible.
   * @param intent the intent to check
   */
  async finalFeasibilityCheck(intent: IntentDataModel) {
    const { error } = await this.feeService.isRouteFeasible(intent)
    if (error) {
      throw error
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
        // Approve the inbox to spend the amount, inbox contract pulls the funds
        // then does the transfer call for the target
        const transferFunctionData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [solver.inboxAddress, dstAmount], //spender, amount
        })

        return [{ to: target, data: transferFunctionData }]
      default:
        return []
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
    return model.intent.route.calls.flatMap((call) => {
      const tt = getTransactionTargetData(solver, call)
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
          return this.handleErc20(tt, solver, call.target)
        case 'erc721':
        case 'erc1155':
        default:
          return []
      }
    })
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

    const isStorageProver = this.proofService.isStorageProver(model.intent.reward.prover)
    if (isStorageProver) {
      return this.getFulfillTxForStorageProver(inboxAddress, claimant, model)
    }

    // Hyper Prover

    const isHyperlane = this.proofService.isHyperlaneProver(model.intent.reward.prover)
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
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
        model.intent.reward.prover,
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
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
        model.intent.reward.prover,
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
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
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
   * @param {Hex} inboxAddress - The address of the inbox smart contract.
   * @param {IntentSourceModel} model - The model containing intent details, including route, hash, and reward information.
   * @return {Promise<Hex | undefined>} A promise that resolves to the fee in hexadecimal format, or undefined if the fee could not be determined.
   */
  private async getHyperlaneFee(inboxAddress: Hex, model: IntentSourceModel): Promise<bigint> {
    const client = await this.kernelAccountClientService.getClient(
      Number(model.intent.route.destination),
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
        pad(model.intent.reward.prover), //_prover
        encodedMessageBody, //_messageBody
        '0x0', //_metadata
        zeroAddress, //_postDispatchHook
      ],
    })

    const proverData = await client.call({
      to: inboxAddress,
      data: callData,
    })
    return BigInt(proverData.data ?? 0)
  }
}
