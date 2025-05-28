import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { encodeFunctionData, Hex, zeroAddress } from 'viem'
import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'
import { EstimatedGasDataForIntentInitiation } from '@/intent-initiation/interfaces/estimated-gas-data-for-intent-initiation.interface'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { GaslessIntentExecutionResponseDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response.dto'
import { GaslessIntentExecutionResponseEntryDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response-entry.dto'
import { GaslessIntentRequestDTO, IntentDTO } from '@/quote/dto/gasless-intent-request.dto'
import { getChainConfig } from '@/eco-configs/utils'
import { hashRoute, IntentSourceAbi, RouteType } from '@eco-foundation/routes-ts'
import { Injectable } from '@nestjs/common'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { InternalQuoteError } from '@/quote/errors'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2Processor } from '@/common/permit/permit2-processor'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { Permit3Processor } from '@/common/permit/permit3-processor'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { QuoteRepository } from '@/quote/quote.repository'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

export type PermitResult = {
  funder: Hex
  permitContract: Hex
  transactions: ExecuteSmartWalletArg[]
}

export interface FundForTransactionData {
  quoteID: string
  tx: ExecuteSmartWalletArg
}

interface GaslessIntentTransactions {
  permitDataPerChain: Map<number, PermitResult>
  fundForTxsPerChain: Map<number, FundForTransactionData[]>
}

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
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
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

  async _initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
    // Get all the txs
    const { response: gaslessIntentTransactions, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequestDTO)

    if (error || !gaslessIntentTransactions) {
      return { error }
    }

    const { permitDataPerChain, fundForTxsPerChain } = gaslessIntentTransactions

    const txPromises = Array.from(fundForTxsPerChain.entries()).map(async ([chainID, fundTxs]) => {
      try {
        const walletClient = await this.walletClientService.getClient(chainID)

        // Get the permit txs for this chain
        const permitTxs = permitDataPerChain.get(chainID)?.transactions ?? []

        // Get the fundFor txs for this chain
        const fundForTxs = fundTxs.map((f) => f.tx)

        // Create and send the batch tx
        const txs = [...permitTxs, ...fundForTxs]
        const tx = batchTransactionsWithMulticall(chainID, txs)
        const txHash = await walletClient.sendTransaction(tx)

        return <GaslessIntentExecutionResponseEntryDTO>{
          chainID,
          quoteIDs: fundTxs.map((f) => f.quoteID),
          transactionHash: txHash,
        }
      } catch (ex) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `_initiateGaslessIntent: error sending transaction for chain ${chainID}`,
            properties: {
              error: ex.message,
            },
          }),
        )

        return <GaslessIntentExecutionResponseEntryDTO>{
          chainID,
          quoteIDs: fundTxs.map((f) => f.quoteID),
          error: ex.message,
        }
      }
    })

    const settledResults = await Promise.allSettled(txPromises)

    const successes: GaslessIntentExecutionResponseEntryDTO[] = []
    const failures: GaslessIntentExecutionResponseEntryDTO[] = []

    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        const gaslessIntentResponse = result.value

        if (gaslessIntentResponse.error) {
          failures.push(gaslessIntentResponse)
        } else {
          successes.push(gaslessIntentResponse)
        }
      } else {
        // Very rare edge case: the entire promise throws
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `_initiateGaslessIntent: unexpected unhandled rejection: ${result.reason}`,
          }),
        )
      }
    }

    // Send to retry queue
    // failures.forEach((failure) => {
    //   retryQueue.enqueue({
    //     chainID: failure.chainID,
    //     quoteIDs: failure.quoteIDs,
    //     error: failure.error,
    //   })
    // })

    return {
      response: {
        successes,
        failures,
      },
    }
  }

  private getTxsGroupedByChain(gaslessIntentTransactions: GaslessIntentTransactions): {
    permitTxsPerChain: Map<number, ExecuteSmartWalletArg[]>
    fundTxsPerChain: Map<number, ExecuteSmartWalletArg[]>
  } {
    const permitTxsPerChain = new Map<number, ExecuteSmartWalletArg[]>()
    const fundTxsPerChain = new Map<number, ExecuteSmartWalletArg[]>()

    for (const [chainID, permitData] of gaslessIntentTransactions.permitDataPerChain.entries()) {
      permitTxsPerChain.set(chainID, permitData.transactions)
    }

    for (const [chainID, fundForList] of gaslessIntentTransactions.fundForTxsPerChain.entries()) {
      fundTxsPerChain.set(
        chainID,
        fundForList.map((f) => f.tx),
      )
    }

    return { permitTxsPerChain, fundTxsPerChain }
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
    const { response: gaslessIntentTransactions, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequest)

    if (error || !gaslessIntentTransactions) {
      return { error }
    }

    const { permitTxsPerChain, fundTxsPerChain } =
      this.getTxsGroupedByChain(gaslessIntentTransactions)

    const chainIDs = Array.from(fundTxsPerChain.keys())

    const estimationRequests = chainIDs.map(async (chainID): Promise<EstimatedGasData> => {
      const permitTransactions = permitTxsPerChain.get(chainID) || []
      const fundForTransactions = fundTxsPerChain.get(chainID) || []

      const { response: estimatedGasData, error: estimateError } =
        await this.walletClientService.estimateGas(chainID, [
          ...permitTransactions,
          ...fundForTransactions,
        ])

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
  ): Promise<EcoResponse<GaslessIntentTransactions>> {
    const { intents } = gaslessIntentRequestDTO

    // Mapping chain ids to permit transactions
    const permitDataPerChain = new Map<number, PermitResult>()

    // Mapping chain ids to transactions
    const fundForTxsPerChain = new Map<number, FundForTransactionData[]>()

    for (const intent of intents) {
      const chainId = Number(intent.route.source)
      const quoteID = intent.quoteID

      // Get the permit tx(s)
      if (!permitDataPerChain.has(chainId)) {
        const { response: permitData, error: permitError } = this.generatePermitTxs(
          chainId,
          gaslessIntentRequestDTO,
        )

        if (permitError || !permitData) {
          return { error: InternalQuoteError(permitError) }
        }

        permitDataPerChain.set(chainId, permitData)
      }

      // Get the fundFor tx
      const permitData = permitDataPerChain.get(chainId)!
      const { response: fundForTx, error: fundForTxError } = await this.getIntentFundForTx(
        intent,
        permitData.funder,
        permitData.permitContract,
      )

      if (fundForTxError || !fundForTx) {
        return { error: InternalQuoteError(fundForTxError) }
      }

      // Add the fundFor tx to the chain's transactions
      if (!fundForTxsPerChain.has(chainId)) {
        fundForTxsPerChain.set(chainId, [])
      }

      fundForTxsPerChain.get(chainId)!.push({
        quoteID: quoteID,
        tx: fundForTx,
      })
    }

    return {
      response: {
        permitDataPerChain,
        fundForTxsPerChain,
      },
    }
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
    const { quoteID, salt, route: quoteRoute } = intent

    const { response: quote, error } = await this.quoteRepository.fetchQuoteIntentData({
      quoteID,
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
    })

    if (error || !quote) {
      return { error }
    }

    // Now we need to get the route hash with the real salt
    const routeWithSalt: RouteType = {
      ...quoteRoute,
      salt,
    }

    const routeHash = hashRoute(routeWithSalt)
    const chainConfig = getChainConfig(Number(intent.route.source))
    const intentSourceContract = chainConfig.IntentSource
    const reward = quote.reward

    // Update intent db
    await this.createIntentService.createIntentFromIntentInitiation(
      quoteID,
      funder,
      routeWithSalt,
      reward,
    )

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
    const permitData = gaslessIntentRequestDTO.gaslessIntentData.permitData || {}
    const { permit = [], permit2 = [], permit3 } = permitData

    const permitTxGenerators: (() => EcoResponse<PermitResult | undefined>)[] = [
      this.getPermitTxs.bind(this, chainId, permit),
      this.getPermit2Txs.bind(this, chainId, permit2),
      this.getPermit3Txs.bind(this, chainId, permit3),
    ]

    for (const permitTxGenerator of permitTxGenerators) {
      const { response: permitResult, error } = permitTxGenerator()

      if (error) {
        return { error }
      }

      if (permitResult) {
        return { response: permitResult }
      }
    }

    return { error: EcoError.NoPermitsProvided }
  }

  private getPermitTxs(
    chainID: number,
    permits: PermitDTO[],
  ): EcoResponse<PermitResult | undefined> {
    const executions = permits.filter((permit) => permit.chainID === chainID)

    if (executions.length === 0) {
      return { response: undefined }
    }

    const { funder } = executions[0]
    const { response: transactions, error } = PermitProcessor.generateTxs(...executions)

    if (error) {
      return { error }
    }

    return {
      response: {
        funder,
        permitContract: zeroAddress,
        transactions: transactions!,
      },
    }
  }

  private getPermit2Txs(
    chainID: number,
    permit2DTO: Permit2DTO[],
  ): EcoResponse<PermitResult | undefined> {
    const transactions = permit2DTO
      .filter((permit) => permit.chainID === chainID)
      .flatMap((permit2) => Permit2Processor.generateTxs(permit2))

    if (transactions.length === 0) {
      return { response: undefined }
    }

    const { permitContract, funder } = permit2DTO[0]

    return {
      response: {
        funder,
        permitContract,
        transactions,
      },
    }
  }

  private getPermit3Txs(
    chainID: number,
    permit3DTO?: Permit3DTO,
  ): EcoResponse<PermitResult | undefined> {
    if (!permit3DTO) {
      return { response: undefined }
    }

    const transaction = Permit3Processor.generateTxs(chainID, permit3DTO)

    if (!transaction) {
      return { response: undefined }
    }

    return {
      response: {
        funder: permit3DTO.owner,
        permitContract: permit3DTO.permitContract,
        transactions: [transaction],
      },
    }
  }
}
