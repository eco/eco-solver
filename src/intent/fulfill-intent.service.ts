import { Injectable, Logger } from '@nestjs/common'
import { Model } from 'mongoose'
import { InjectModel } from '@nestjs/mongoose'
import {
  ContractFunctionArgs,
  ContractFunctionName,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  Hex,
  pad,
  zeroAddress,
} from 'viem'
import {
  IntentProcessData,
  TransactionTargetData,
  UtilsIntentService,
} from './utils-intent.service'
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

type FulfillmentMethod = ContractFunctionName<typeof InboxAbi>

/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
@Injectable()
export class FulfillIntentService {
  private logger = new Logger(FulfillIntentService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly proofService: ProofService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
  ) {}

  /**
   * Executes the fulfill intent process for an intent. It creates the transaction for fulfillment, and posts it
   * to the chain. It then updates the db model of the intent with the status and receipt.
   *
   * @param intentHash the intent hash to fulfill
   * @returns
   */
  async executeFulfillIntent(intentHash: Hex) {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}
    if (!data || !model || !solver) {
      if (err) {
        throw err
      }
      return
    }
    // If the intent is already solved, return
    // Could happen if redis has pending job while this is still executing
    if (model.status === 'SOLVED') {
      return
    }

    const kernelAccountClient = await this.kernelAccountClientService.getClient(solver.chainID)

    // Create transactions for intent targets
    const targetSolveTxs = this.getTransactionsForTargets(data)

    // Create fulfill tx
    const fulfillTx = await this.getFulfillIntentTx(solver.inboxAddress, model)

    // Combine all transactions
    const transactions = [...targetSolveTxs, fulfillTx]

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `Fulfilling ${this.getFulfillment()} transaction`,
        properties: {
          transactions,
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
            destinationChainID: model.intent.route.destination,
            sourceChainID: model.event.sourceChainID,
          },
        }),
      )
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
   * Returns the transactions for the intent targets
   * @param intentProcessData
   * @private
   */
  private getTransactionsForTargets(intentProcessData: IntentProcessData) {
    const { model, solver } = intentProcessData
    if (!model || !solver) {
      return []
    }

    // Create transactions for intent targets
    return model.intent.route.calls.flatMap((call) => {
      const tt = this.utilsIntentService.getTransactionTargetData(model.intent, solver, call)
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
    const isHyperlane = this.proofService.isHyperlaneProver(model.intent.reward.prover)
    const functionName: FulfillmentMethod = this.proofService.isStorageProver(
      model.intent.reward.prover,
    )
      ? 'fulfillStorage'
      : this.getFulfillment()

    const args = [
      model.intent.route,
      // @ts-expect-error we dynamically set the args
      model.intent.reward.getHash(),
      claimant,
      // @ts-expect-error we dynamically set the args
      model.intent.getHash().intentHash,
    ]

    if (isHyperlane) {
      args.push(model.intent.reward.prover)
      if (functionName === 'fulfillHyperInstantWithRelayer') {
        args.push('0x0')
        args.push(zeroAddress)
      }
    }
    let fee = 0n
    if (isHyperlane && functionName === 'fulfillHyperInstantWithRelayer') {
      fee = BigInt((await this.getHyperlaneFee(inboxAddress, model)) || '0x0')
    }

    const fulfillIntentData = encodeFunctionData({
      abi: InboxAbi,
      functionName,
      // @ts-expect-error we dynamically set the args
      args,
    })

    return {
      to: inboxAddress,
      data: fulfillIntentData,
      // ...(isHyperlane && fee > 0 && { value: fee }),
      value: fee,
    }
  }

  /**
   * Returns the hyperlane fee
   * @param prover
   * @private
   */
  private async getHyperlaneFee(
    inboxAddress: Hex,
    model: IntentSourceModel,
  ): Promise<Hex | undefined> {
    const client = await this.kernelAccountClientService.getClient(
      Number(model.intent.route.destination),
    )
    const encodedMessageBody = encodeAbiParameters(
      [{ type: 'bytes[]' }, { type: 'address[]' }],
      [[model.intent.hash], [this.ecoConfigService.getEth().claimant]],
    )
    const functionName = 'fetchFee'
    const args: ContractFunctionArgs<typeof InboxAbi, 'view', typeof functionName> = [
      model.event.sourceChainID, //_sourceChainID
      pad(model.intent.reward.prover), //_prover
      encodedMessageBody, //_messageBody
      '0x0', //_metadata
      zeroAddress, //_postDispatchHook
    ]
    const callData = encodeFunctionData({
      abi: InboxAbi,
      functionName,
      args,
    })
    const proverData = await client.call({
      to: inboxAddress,
      data: callData,
    })
    return proverData.data
  }

  /**
   * @returns the fulfillment method
   */
  private getFulfillment(): FulfillmentMethod {
    switch (this.ecoConfigService.getFulfill().run) {
      case 'batch':
        return 'fulfillHyperBatched'
      case 'single':
      default:
        return 'fulfillHyperInstantWithRelayer'
    }
  }
}
