import { Injectable, Logger } from '@nestjs/common'
import {
  Call,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  Hex,
  pad,
  zeroAddress,
} from 'viem'
import { IMessageBridgeProverAbi, InboxAbi } from '@eco-foundation/routes-ts'
import { TransactionTargetData, UtilsIntentService } from './utils-intent.service'
import { CallDataInterface, getERC20Selector } from '@/contracts'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FeeService } from '@/fee/fee.service'
import { ProofService } from '@/prover/proof.service'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import {
  getFunctionCalls,
  getNativeCalls,
  getNativeFulfill,
  getTransactionTargetData,
  getWaitForTransactionTimeout,
} from '@/intent/utils'
import { IFulfillService } from '@/intent/interfaces/fulfill-service.interface'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { RewardDataModel } from '@/intent/schemas/reward-data.schema'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { getChainConfig } from '@/eco-configs/utils'
import { EcoAnalyticsService } from '@/analytics'

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
    private readonly ecoAnalytics: EcoAnalyticsService,
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
    const startTime = Date.now()

    const kernelAccountClient = await this.kernelAccountClientService.getClient(solver.chainID)

    // Create transactions for intent targets
    const targetSolveTxs = this.getTransactionsForTargets(model, solver)

    const nativeCalls = getNativeCalls(model.intent.route.calls)
    const nativeFulfill = this.getNativeFulfill(solver, nativeCalls)

    // Create fulfill tx
    const fulfillTx = await this.getFulfillIntentTx(solver.inboxAddress, model)
    fulfillTx.value = fulfillTx.value ?? 0n
    fulfillTx.value += nativeFulfill?.value || 0n // Add the native fulfill value to the fulfill tx

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

      const receipt = await kernelAccountClient.waitForTransactionReceipt({
        hash: transactionHash,
        timeout: getWaitForTransactionTimeout(model.intent.route.destination),
      })

      // set the status and receipt for the model
      model.receipt = receipt as any
      if (receipt.status === 'reverted') {
        this.ecoAnalytics.trackIntentFulfillmentTransactionReverted(model, solver, receipt)
        throw EcoError.FulfillIntentRevertError(receipt)
      }
      model.status = 'SOLVED'

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Fulfilled transactionHash ${receipt.transactionHash}`,
          properties: {
            userOPHash: receipt,
            destinationChainID: model.intent.route.destination,
            sourceChainID: IntentSourceModel.getSource(model),
          },
        }),
      )

      const processingTime = Date.now() - startTime
      this.ecoAnalytics.trackIntentFulfillmentSuccess(model, solver, receipt, processingTime)

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

      const processingTime = Date.now() - startTime
      this.ecoAnalytics.trackIntentFulfillmentFailed(model, solver, e, processingTime)

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
      this.ecoAnalytics.trackIntentFeasibilityCheckFailed(intent, error)
      throw error
    }

    this.ecoAnalytics.trackIntentFeasibilityCheckSuccess(intent)
  }

  /**
   * Checks if the transaction is feasible for an erc20 token transfer.
   *
   * @param tt the transaction target data
   * @param solver the target solver
   * @param target the target ERC20 address
   * @returns
   */
  handleErc20(tt: TransactionTargetData, solver: Solver, target: Hex): Call[] {
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

        const result = [{ to: target, value: 0n, data: transferFunctionData }]
        this.ecoAnalytics.trackErc20TransactionHandlingSuccess(tt, solver, target, result)
        return result
      default:
        this.ecoAnalytics.trackErc20TransactionHandlingUnsupported(tt, solver, target)
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
    const functionCalls = getFunctionCalls(model.intent.route.calls)

    // Create transactions for intent targets
    const functionFulfills = functionCalls.flatMap((call) => {
      const tt = getTransactionTargetData(solver, call)
      if (tt === null) {
        this.ecoAnalytics.trackTransactionTargetGenerationError(model, solver, call)
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
          this.ecoAnalytics.trackTransactionTargetUnsupportedContractType(model, solver, tt)
          return []
      }
    })

    this.ecoAnalytics.trackTransactionTargetGenerationSuccess(model, solver, functionFulfills)
    return functionFulfills
  }

  /**
   * Creates a native transfer call that sends the total native value required by the intent to the inbox contract.
   * Uses the utility function to calculate the total native value from all native calls in the intent.
   *
   * @param solver - The solver configuration containing the inbox address
   * @param nativeCalls - The calls that have native value transfers (from getNativeCalls)
   * @returns A Call object that transfers the total native value to the inbox contract
   */
  private getNativeFulfill(solver: Solver, nativeCalls: CallDataInterface[]): Call {
    return {
      to: solver.inboxAddress,
      value: getNativeFulfill(nativeCalls),
      data: '0x',
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

    // Hyper Prover
    const isHyperlane = this.proofService.isHyperlaneProver(
      Number(model.intent.route.source),
      model.intent.reward.prover,
    )
    if (isHyperlane) {
      const result = await this.getFulfillTxForHyperprover(inboxAddress, claimant, model)
      this.ecoAnalytics.trackFulfillIntentTxCreationSuccess(
        model,
        inboxAddress,
        'hyperlane',
        result,
      )
      return result
    }

    // Metalayer Prover
    const isMetalayer = this.proofService.isMetalayerProver(
      Number(model.intent.route.source),
      model.intent.reward.prover,
    )
    if (isMetalayer) {
      const result = await this.getFulfillTxForMetalayer(inboxAddress, claimant, model)
      this.ecoAnalytics.trackFulfillIntentTxCreationSuccess(
        model,
        inboxAddress,
        'metalayer',
        result,
      )
      return result
    }

    const error = new Error('Unsupported fulfillment method')
    this.ecoAnalytics.trackFulfillIntentTxCreationFailed(model, inboxAddress, error)
    throw error
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
    const { HyperProver: hyperProverAddr } = getChainConfig(Number(model.intent.route.destination))

    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfill',
      args: [
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
        hyperProverAddr,
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
    const { HyperProver: hyperProverAddr } = getChainConfig(Number(model.intent.route.destination))

    const messageData = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
      [pad(model.intent.reward.prover), '0x', zeroAddress],
    )

    const fee = await this.getProverFee(model, claimant, hyperProverAddr, messageData)

    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfillAndProve',
      args: [
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
        hyperProverAddr,
        messageData,
      ],
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      value: fee,
    }
  }

  /**
   * Generates a transaction to fulfill an intent for a metalayer prover.
   *
   * @param {Hex} inboxAddress - The address of the inbox associated with the transaction.
   * @param {Hex} claimant - The address of the claimant requesting fulfillment.
   * @param {IntentSourceModel} model - The model containing the details of the intent to fulfill.
   * @return {Promise<ExecuteSmartWalletArg>} A promise resolving to the transaction arguments needed to fulfill the intent.
   */
  private async getFulfillTxForMetalayer(
    inboxAddress: Hex,
    claimant: Hex,
    model: IntentSourceModel,
  ): Promise<ExecuteSmartWalletArg> {
    const { MetaProver: metalayerProverAddr } = getChainConfig(
      Number(model.intent.route.destination),
    )

    if (!metalayerProverAddr) {
      throw new Error('Metalayer prover address not found in chain config')
    }

    const messageData = encodeAbiParameters(
      [{ type: 'bytes32' }],
      [pad(model.intent.reward.prover)],
    )

    // Metalayer may use the same fee structure as Hyperlane
    const fee = await this.getProverFee(model, claimant, metalayerProverAddr, messageData)

    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'fulfillAndProve',
      args: [
        model.intent.route,
        RewardDataModel.getHash(model.intent.reward),
        claimant,
        IntentDataModel.getHash(model.intent).intentHash,
        metalayerProverAddr,
        messageData,
      ],
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      value: fee,
    }
  }

  /**
   * Calculates the fee required for a transaction by calling the prover contract.
   *
   * @param {IntentSourceModel} model - The model containing intent details, including route, hash, and reward information.
   * @param claimant - The claimant address
   * @param proverAddr - The address of the prover contract
   * @param messageData - The message data to send
   * @return {Promise<bigint>} A promise that resolves to the fee amount
   */
  private async getProverFee(
    model: IntentSourceModel,
    claimant: Hex,
    proverAddr: Hex,
    messageData: Hex,
  ): Promise<bigint> {
    const client = await this.kernelAccountClientService.getClient(
      Number(model.intent.route.destination),
    )

    const callData = encodeFunctionData({
      abi: IMessageBridgeProverAbi,
      functionName: 'fetchFee',
      args: [
        IntentSourceModel.getSource(model), //_sourceChainID
        [model.intent.hash],
        [claimant],
        messageData,
      ],
    })

    const proverData = await client.call({
      to: proverAddr,
      data: callData,
    })
    return BigInt(proverData.data ?? 0)
  }
}
