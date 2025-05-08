import { Injectable } from '@nestjs/common'
import { hashRoute, IntentSourceAbi } from '@eco-foundation/routes-ts'
import { encodeFunctionData, Hex, zeroAddress } from 'viem'
import * as _ from 'lodash'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { EstimatedGasDataForIntentInitiation } from '@/intent-initiation/interfaces/estimated-gas-data-for-intent-initiation.interface'
import { getChainConfig } from '@/eco-configs/utils'
import { InternalQuoteError } from '@/quote/errors'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { QuoteRepository } from '@/quote/quote.repository'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { GaslessIntentRequestDTO, IntentDTO } from '@/quote/dto/gasless-intent-request.dto'
import { EcoError } from '@/common/errors/eco-error'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { Permit2Processor } from '@/common/permit/permit2-processor'
import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'
import { Permit3Processor } from '@/common/permit/permit3-processor'

type PermitResult = { funder: Hex; permitContract: Hex; transactions: ExecuteSmartWalletArg[] }

@Injectable()
export class IntentInitiationService {
  private logger = new EcoLogger(IntentInitiationService.name)

  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly createIntentService: CreateIntentService,
    private readonly walletClientService: WalletClientDefaultSignerService,
  ) {}

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<Record<number, string>>> {
    try {
      return await this._initiateGaslessIntent(gaslessIntentRequestDTO)
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `initiateGaslessIntent: error`,
          properties: {
            error: ex.message,
          },
        }),
        ex.stack,
      )

      return { error: InternalQuoteError(ex) }
    }
  }

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async _initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<Record<number, Hex>>> {
    // Get all the txs
    const { response: allTxs, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequestDTO)

    if (error || !allTxs) {
      return { error }
    }

    const chainIDs = allTxs.keys()

    const receiptPromises = Array.from(chainIDs).map(async (chainID) => {
      const walletClient = await this.walletClientService.getClient(chainID)
      const txs = allTxs.get(chainID)!
      return walletClient.sendTransaction(batchTransactionsWithMulticall(chainID, txs))
    })

    const receipts: Record<number, Hex> = _.zipObject(
      Array.from(chainIDs),
      await Promise.all(receiptPromises),
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `_initiateGaslessIntent`,
        properties: { receipts },
      }),
    )

    return { response: receipts }
  }

  /*
   * This function is used to calculate the gas quote for the gasless intent.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async calculateGasQuoteForIntent(
    gaslessIntentRequest: GaslessIntentRequestDTO,
    bufferPercent = 10,
  ): Promise<EcoResponse<EstimatedGasDataForIntentInitiation>> {
    // Generate the actual txs (permit(s) + fundFor)
    const { response: allTxs, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequest)

    if (error || !allTxs) {
      return { error }
    }

    const chainIDs = Array.from(allTxs.keys())

    const estimationRequests = chainIDs.map(async (chainID): Promise<EstimatedGasData> => {
      const transactions = allTxs.get(chainID)!
      const { response: estimatedGasData, error: estimateError } =
        await this.walletClientService.estimateGas(chainID, transactions)

      if (estimateError || !estimatedGasData) {
        throw estimateError
      }

      const { gasEstimate: estimatedGasInWei, gasPrice } = estimatedGasData

      // Apply a buffer (e.g., 10%)
      const base = 1_000_000n
      const totalWithBuffer =
        (estimatedGasInWei * BigInt((1 + bufferPercent / 100) * Number(base))) / base
      const gasCost = totalWithBuffer * gasPrice

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `calculateGasQuoteForIntent: estimated gas details`,
          properties: {
            chainID,
            estimatedGas: estimatedGasInWei,
            totalWithBuffer,
            price: gasPrice,
            totalCost: gasCost,
          },
        }),
      )

      return {
        chainID,
        gasEstimate: estimatedGasInWei,
        gasPrice,
        gasCost,
      }
    })

    try {
      const estimations = await Promise.all(estimationRequests)
      const gasCost = estimations.reduce((acc, item) => acc + item.gasCost, 0n)

      return {
        response: {
          estimations,
          gasCost,
        },
      }
    } catch (ex) {
      return { error: InternalQuoteError(new Error(`Gas estimation failed: ${ex.message}`)) }
    }
  }

  /**
   * This function is used to generate the transactions for the gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async generateGaslessIntentTransactions(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<Map<number, ExecuteSmartWalletArg[]>>> {
    const { intents } = gaslessIntentRequestDTO

    // Mapping chain ids to transactions
    const txsPerChain = new Map<number, ExecuteSmartWalletArg[]>()

    for (const intent of intents) {
      const chainId = Number(intent.route.source)

      // Get the permit tx(s)
      const { response: permitData, error: permitError } = this.generatePermitTxs(
        chainId,
        gaslessIntentRequestDTO,
      )

      if (permitError || !permitData) {
        return { error: InternalQuoteError(permitError) }
      }

      // Get the fundFor tx
      const { response: fundForTx, error: fundForTxError } = await this.getIntentFundForTx(
        intent,
        permitData.funder,
        permitData.permitContract,
      )

      if (fundForTxError || !fundForTx) {
        return { error: InternalQuoteError(fundForTxError) }
      }

      txsPerChain.set(chainId, [fundForTx, ...permitData.transactions])
    }

    return { response: txsPerChain }
  }

  /**
   * This function is used to get the set of transactions for the gasless intent.
   * These comprise the fundFor tx as well as the permit/permit2 txs.
   * @returns
   * @param intent
   * @param funder
   * @param permitContract
   */
  private async getIntentFundForTx(
    intent: IntentDTO,
    funder: Hex,
    permitContract: Hex,
  ): Promise<EcoResponse<ExecuteSmartWalletArg>> {
    const { quoteID, route } = intent

    const { response: quote, error } = await this.quoteRepository.fetchQuoteIntentData({
      quoteID,
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
    })

    if (error || !quote) {
      return { error }
    }

    const routeHash = hashRoute(route)
    const chainConfig = getChainConfig(Number(intent.route.source))
    const intentSourceContract = chainConfig.IntentSource
    const reward = quote.reward

    // Update intent db
    await this.createIntentService.createIntentFromIntentInitiation(quoteID, funder, route, reward)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getIntentFundForTx: encodeFunctionData args:`,
        properties: {
          routeHash: routeHash,
          reward: quote!.reward,
        },
      }),
    )

    // Encode transaction
    const data = encodeFunctionData({
      abi: IntentSourceAbi,
      functionName: 'fundFor',
      args: [routeHash, reward, funder, permitContract, false],
    })

    // Final transaction object
    const fundTx = {
      to: intentSourceContract,
      data,
      value: 0n,
    }

    return { response: fundTx }
  }

  private generatePermitTxs(
    chainId: number,
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): EcoResponse<PermitResult> {
    const { permitData } = gaslessIntentRequestDTO.gaslessIntentData

    const { permit = [], permit2 = [], permit3 } = permitData ?? {}

    const permitResult = this.getPermitTxs(chainId, permit)
    if (!permitResult.error) return { error: permitResult.error }
    if (permitResult.response) return { response: permitResult.response }

    const permit2Result = this.getPermit2Txs(chainId, permit2)
    if (permit2Result.error) return { error: permit2Result.error }
    if (permit2Result.response) return { response: permit2Result.response }

    const permit3Result = this.getPermit3Txs(chainId, permit3)
    if (permit3Result.error) return { error: permit3Result.error }
    if (permit3Result.response) return { response: permit3Result.response }

    return { error: EcoError.NoPermitsProvided }
  }

  private getPermitTxs(
    chainID: number,
    permits: PermitDTO[],
  ): EcoResponse<PermitResult | undefined> {
    const executions = permits.filter((permit) => permit.chainID === chainID)
    if (executions.length === 0) return { response: undefined }

    const { funder } = executions[0]
    const { response: transactions, error } = PermitProcessor.generateTxs(...executions)

    if (error || !transactions) return { error }

    return { response: { funder, permitContract: zeroAddress, transactions } }
  }

  private getPermit2Txs(
    chainID: number,
    permit2DTO: Permit2DTO[],
  ): EcoResponse<PermitResult | undefined> {
    const transactions = permit2DTO
      .filter((permit) => permit.chainID === chainID)
      .flatMap((permit2) => Permit2Processor.generateTxs(permit2))

    if (transactions.length === 0) return { response: undefined }

    const { permitContract, funder } = permit2DTO[0]

    return { response: { permitContract, funder, transactions } }
  }

  private getPermit3Txs(
    chainID: number,
    permit3DTO?: Permit3DTO,
  ): EcoResponse<PermitResult | undefined> {
    if (!permit3DTO) return { response: undefined }

    const transaction = Permit3Processor.generateTxs(chainID, permit3DTO)
    if (!transaction) return { response: undefined }

    return {
      response: {
        funder: permit3DTO.owner,
        permitContract: permit3DTO.permitContract,
        transactions: [transaction],
      },
    }
  }
}
