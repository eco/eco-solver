import { AllowanceOrTransferDTO } from '@/quote/dto/permit3/allowance-or-transfer.dto'
import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext, LogSubOperation } from '@/common/logging/decorators'
import { EcoResponse } from '@/common/eco-response'
import { encodeFunctionData, Hex, zeroAddress } from 'viem'
import { EstimatedGasData } from '@/transaction/smart-wallets/kernel/interfaces/estimated-gas-data.interface'
import { EstimatedGasDataForIntentInitiation } from '@/intent-initiation/interfaces/estimated-gas-data-for-intent-initiation.interface'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { FulfillmentLog } from '@/contracts/inbox'
import { GaslessIntentExecutionResponseDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response.dto'
import { GaslessIntentExecutionResponseEntryDTO } from '@/intent-initiation/dtos/gasless-intent-execution-response-entry.dto'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { GaslessIntentTransactionDataDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data.dto'
import { GaslessIntentTransactionDataRequestDTO } from '@/intent-initiation/dtos/gasless-intent-transaction-data-request.dto'
import { getChainConfig } from '@/eco-configs/utils'
import { GroupedIntentRepository } from '@/intent-initiation/repositories/grouped-intent.repository'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { InternalQuoteError } from '@/quote/errors'
import { KernelExecuteAbi } from '@/contracts'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2Processor } from '@/common/permit/permit2-processor'
import { permit3Abi } from '@/contracts/Permit3.abi'
import { Permit3DTO } from '@/quote/dto/permit3/permit3.dto'
import { Permit3Validator } from '@/intent-initiation/permit-validation/permit3-validator'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { RouteType, hashRoute, IntentSourceAbi } from '@eco-foundation/routes-ts'
import { StandardMerkleBuilder } from '@/common/permit/standard-merkle-builder'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

const GAS_ESTIMATION_BUFFER_BASE = 1_000_000n

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
export class IntentInitiationService implements OnModuleInit {
  private gaslessIntentdAppIDs: string[]

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly quoteRepository: QuoteRepository,
    private readonly groupedIntentRepository: GroupedIntentRepository,
    private readonly intentSourceRepository: IntentSourceRepository,
    private readonly walletClientService: WalletClientDefaultSignerService,
    private readonly permitValidationService: PermitValidationService,
  ) {}

  onModuleInit() {
    this.gaslessIntentdAppIDs = this.ecoConfigService.getGaslessIntentdAppIDs()
  }

  @LogOperation('gasless_intent_transaction_data_fetch', IntentOperationLogger)
  async getGaslessIntentTransactionData(
    @LogContext gaslessIntentTransactionDataRequestDTO: GaslessIntentTransactionDataRequestDTO,
  ): Promise<EcoResponse<GaslessIntentTransactionDataDTO>> {
    const { intentGroupID } = gaslessIntentTransactionDataRequestDTO
    const { response: groupedIntent, error } =
      await this.groupedIntentRepository.getIntentForGroupID(intentGroupID)

    if (error) {
      return { error }
    }

    const { destinationChainID, destinationChainTxHash } = groupedIntent!

    return {
      response: {
        intentGroupID,
        destinationChainID,
        destinationChainTxHash,
      },
    }
  }

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  @LogOperation('gasless_intent_initiation', IntentOperationLogger)
  async initiateGaslessIntent(
    @LogContext gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
    const { error } = this.checkGaslessIntentSupported(gaslessIntentRequestDTO)

    if (error) {
      return { error }
    }

    return await this._initiateGaslessIntent(gaslessIntentRequestDTO)
  }

  private checkGaslessIntentSupported(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): EcoResponse<void> {
    const { dAppID } = gaslessIntentRequestDTO

    if (!this.gaslessIntentdAppIDs.includes(dAppID)) {
      return { error: EcoError.GaslessIntentsNotSupported }
    }

    return {}
  }

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  @LogSubOperation('gasless_intent_execution')
  async _initiateGaslessIntent(
    @LogContext gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentExecutionResponseDTO>> {
    const { response: gaslessIntentTransactions, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequestDTO)

    if (error) {
      return { error }
    }

    const { permitDataPerChain, fundForTxsPerChain } = gaslessIntentTransactions!

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
        // Let the decorator handle error logging
        throw ex
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
        // Very rare edge case: the entire promise throws - let decorator logging handle this
        // The error will be captured by the parent operation decorator
        throw new Error(`Unexpected unhandled rejection: ${result.reason}`)
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

  @LogSubOperation('permit3_final_transfer')
  private async executeFinalPermitTransfer(
    @LogContext chainID: number,
    @LogContext permit3: Permit3DTO,
  ): Promise<EcoResponse<string>> {
    const { response: permitResult, error } = await this.getPermit3Txs(chainID, permit3)

    if (error || !permitResult) {
      return { error: InternalQuoteError(error) }
    }

    const walletClient = await this.walletClientService.getClient(chainID)

    // Get the permit txs for this chain
    const permitTxs = permitResult!.transactions

    // Create and send the batch tx
    const tx = batchTransactionsWithMulticall(chainID, permitTxs)

    const txHash = await walletClient.sendTransaction(tx)
    return { response: txHash }
  }

  @LogSubOperation('final_permit_transfer_check')
  private hasFinalPermitTransfer(@LogContext permit3: Permit3DTO): boolean {
    return permit3.allowanceOrTransfers.length > 1
  }

  @LogOperation('fulfillment_processing', IntentOperationLogger)
  async processFulfilled(@LogContext fulfillmentLog: FulfillmentLog) {
    await this._processFulfilled(fulfillmentLog.args._hash)
  }

  @LogSubOperation('fulfillment_intent_processing')
  async _processFulfilled(@LogContext hash: string) {
    const intentSource = await this.intentSourceRepository.getIntent(hash)

    if (!intentSource) {
      throw new Error(`Intent not found for hash ${hash}`)
    }

    const intentGroupID = intentSource.intent.intentGroupID

    if (!intentGroupID) {
      throw new Error(`Intent group ID not found for intent with hash ${hash}`)
    }

    const intents = await this.intentSourceRepository.getIntentsForGroupID(intentGroupID)

    if (intents.length === 0) {
      throw new Error(`No intents found for intent group ID ${intentGroupID}`)
    }

    if (!intents.every((i) => i.status === 'SOLVED')) {
      // This is expected - not all intents solved yet, return without error
      return
    }

    // We can execute the final transfer
    const { response: groupedIntent, error: intentError } =
      await this.groupedIntentRepository.getIntentForGroupID(intentGroupID)

    if (intentError) {
      throw new Error(`Grouped intent not found for intent group ID ${intentGroupID}`)
    }

    const { permit3 } = groupedIntent!

    if (!permit3) {
      throw new Error(`Permit3 not found for intent group ID ${intentGroupID}`)
    }

    // Get chainID and recipient for final transfer
    const destinationChainID = Number(intents[0].intent.route.destination)

    // Check to see if a final transfer was provided
    const hasFinalTransfer = this.hasFinalPermitTransfer(permit3)

    if (!hasFinalTransfer) {
      throw new Error(`No final permit transfer found for intent group ID ${intentGroupID}`)
    }

    const { response: txHash, error: finalTxError } = await this.executeFinalPermitTransfer(
      destinationChainID,
      permit3,
    )

    if (finalTxError) {
      throw finalTxError
    }

    // Update the grouped intent with the destination chain ID and transaction hash
    await this.groupedIntentRepository.updateIntent(intentGroupID, {
      destinationChainID,
      destinationChainTxHash: txHash,
    })
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
  @LogOperation('gas_quote_calculation', IntentOperationLogger)
  async calculateGasQuoteForIntent(
    @LogContext gaslessIntentRequest: GaslessIntentRequestDTO,
    @LogContext bufferPercent = 10,
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
      const base = GAS_ESTIMATION_BUFFER_BASE
      const totalWithBuffer =
        (estimatedGasInWei * BigInt((1 + bufferPercent / 100) * Number(base))) / base
      const gasCost = totalWithBuffer * gasPrice

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

  @LogOperation('gas_price_fetch', IntentOperationLogger)
  async getGasPrice(
    @LogContext chainID: number,
    @LogContext defaultValue: bigint,
  ): Promise<bigint> {
    try {
      const publicClient = await this.walletClientService.getPublicClient(chainID)
      const gasPrice = await publicClient.getGasPrice()
      return gasPrice
    } catch (ex) {
      return defaultValue
    }
  }

  /**
   * This function is used to generate the transactions for the gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  @LogOperation('gasless_intent_transaction_generation', IntentOperationLogger)
  async generateGaslessIntentTransactions(
    @LogContext gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<GaslessIntentTransactions>> {
    const {
      intentGroupID,
      intents,
      gaslessIntentData: { permitData },
    } = gaslessIntentRequestDTO

    // Mapping chain ids to permit transactions
    const permitDataPerChain = new Map<number, PermitResult>()

    // Mapping chain ids to transactions
    const fundForTxsPerChain = new Map<number, FundForTransactionData[]>()

    for (const intent of intents) {
      const { quoteID, salt } = intent
      const { response, error: quoteFetchError } = await this.getQuote(quoteID)

      if (quoteFetchError) {
        return { error: InternalQuoteError(quoteFetchError) }
      }

      const quote = response!
      const chainId = Number(quote.route.source)

      // Get the permit tx(s)
      if (!permitDataPerChain.has(chainId)) {
        const { response: permitData, error: permitError } = await this.generatePermitTxs(
          chainId,
          quote,
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
        intentGroupID,
        quote,
        salt,
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
        quoteID,
        tx: fundForTx,
      })
    }

    // Save the permit data to the database
    await this.groupedIntentRepository.addIntent({
      intentGroupID,
      ...permitData!,
    })

    return {
      response: {
        permitDataPerChain,
        fundForTxsPerChain,
      },
    }
  }

  @LogSubOperation('quote_fetch')
  private async getQuote(@LogContext quoteID: string): Promise<EcoResponse<QuoteIntentModel>> {
    const { response: quote, error } = await this.quoteRepository.fetchQuoteIntentData({
      quoteID,
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
    })

    if (error) {
      return { error }
    }

    return { response: quote! }
  }

  /**
   * This function is used to get the set of transactions for the gasless intent.
   * These comprise the fundFor tx as well as the permit/permit2 txs.
   */
  @LogSubOperation('fund_for_transaction_generation')
  private async getIntentFundForTx(
    @LogContext intentGroupID: string,
    @LogContext quote: QuoteIntentModel,
    @LogContext salt: Hex,
    @LogContext funder: Hex,
    @LogContext permitContract: Hex,
  ): Promise<EcoResponse<ExecuteSmartWalletArg>> {
    quote = QuoteIntentModel.fromJSON(quote)
    const quoteRoute = quote.getQuoteRouteData!()
    const quoteReward = quote.getQuoteRewardData!()

    // Now we need to get the route hash with the real salt
    const routeWithSalt: RouteType = {
      ...quoteRoute,
      salt,
    }

    const { quoteID } = quote
    const realRouteHash = hashRoute(routeWithSalt)
    const chainConfig = getChainConfig(Number(quoteRoute.source))
    const intentSourceContract = chainConfig.IntentSource

    // Update intent db
    await this.intentSourceRepository.createIntentFromIntentInitiation(
      intentGroupID,
      quoteID,
      funder,
      routeWithSalt,
      quoteReward,
    )

    const args = [realRouteHash, quoteReward, funder, permitContract, false] as const

    // Encode transaction
    const data = encodeFunctionData({
      abi: IntentSourceAbi,
      functionName: 'fundFor',
      args,
    })

    // Final transaction object
    const fundTx = {
      to: intentSourceContract,
      data,
      value: 0n,
    }

    return { response: fundTx }
  }

  @LogSubOperation('permit_transaction_generation')
  private async generatePermitTxs(
    @LogContext chainId: number,
    @LogContext quote: QuoteIntentModel,
    @LogContext gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<PermitResult>> {
    const permitData = gaslessIntentRequestDTO.gaslessIntentData.permitData || {}
    const { permit = [], permit2 = [], permit3 } = permitData
    const { reward } = quote

    const { error: permitValidationError } = await this.permitValidationService.validatePermits({
      chainId,
      permits: permit,
      permit2s: permit2,
      reward,
    })

    if (permitValidationError) {
      return { error: permitValidationError }
    }

    const permitTxGenerators: (() => Promise<EcoResponse<PermitResult | undefined>>)[] = [
      this.getPermitTxs.bind(this, chainId, permit),
      this.getPermit2Txs.bind(this, chainId, permit2),
      this.getPermit3Txs.bind(this, chainId, permit3),
    ]

    for (const permitTxGenerator of permitTxGenerators) {
      const { response: permitResult, error } = await permitTxGenerator()

      if (error) {
        return { error }
      }

      if (permitResult) {
        return { response: permitResult }
      }
    }

    return { error: EcoError.NoPermitsProvided }
  }

  @LogSubOperation('permit_generation')
  private async getPermitTxs(
    @LogContext chainID: number,
    @LogContext permits: PermitDTO[],
  ): Promise<EcoResponse<PermitResult | undefined>> {
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

  @LogSubOperation('permit2_generation')
  private async getPermit2Txs(
    @LogContext chainID: number,
    @LogContext permit2DTO: Permit2DTO[],
  ): Promise<EcoResponse<PermitResult | undefined>> {
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

  @LogSubOperation('permit3_generation')
  private async getPermit3Txs(
    @LogContext chainID: number,
    @LogContext permit3DTO?: Permit3DTO,
  ): Promise<EcoResponse<PermitResult | undefined>> {
    if (!permit3DTO) {
      return { response: undefined }
    }

    const { response: transaction, error } = await this.generateTxs(
      chainID,
      permit3DTO,
      this.walletClientService,
    )

    if (error) {
      return { error }
    }

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

  @LogSubOperation('permit3_transaction_generation')
  async generateTxs(
    @LogContext chainID: number,
    @LogContext permit3: Permit3DTO,
    @LogContext walletClientService: WalletClientDefaultSignerService,
  ): Promise<EcoResponse<ExecuteSmartWalletArg | undefined>> {
    const permitsByChain: Record<number, AllowanceOrTransferDTO[]> = {}

    // Rebuild permitsByChain from all allowanceOrTransfers
    for (const p of permit3.allowanceOrTransfers) {
      if (!permitsByChain[p.chainID]) {
        permitsByChain[p.chainID] = []
      }
      permitsByChain[p.chainID].push(p)
    }

    const thisChainPermits = permitsByChain[chainID]
    if (!thisChainPermits) {
      return { response: undefined }
    }

    // Build Merkle tree
    const builder = new StandardMerkleBuilder()
    const { response: crossChainProofs, error } = builder.createCrossChainProofs(permitsByChain)

    if (error) {
      return { error: EcoError.PermitProofConstructionFailed }
    }

    const { merkleRoot, proofsByChainId } = crossChainProofs!
    const proofData = proofsByChainId.get(BigInt(chainID))

    if (!proofData) {
      return { error: new Error(`Missing proof for chain ${chainID}`) }
    }

    const { proof } = proofData
    const { owner, salt, deadline, timestamp, signature, permitContract } = permit3

    // Run validation
    const { error: permitValidationError } = await Permit3Validator.validatePermit({
      owner,
      salt,
      deadline,
      timestamp,
      merkleRoot,
      signature,
      permitContract,
    })

    if (permitValidationError) {
      throw permitValidationError
    }

    // Encode the Permit3 function call
    const chainPermits = {
      chainId: BigInt(chainID),
      permits: thisChainPermits.map((p) => ({
        modeOrExpiration: p.modeOrExpiration,
        tokenKey: p.tokenKey,
        account: p.account,
        amountDelta: p.amountDelta,
      })),
    }

    const permitData = encodeFunctionData({
      abi: permit3Abi,
      functionName: 'permit',
      args: [owner, salt, deadline, timestamp, chainPermits, proof, signature],
    })

    // Simulate it before returning
    const publicClient = await walletClientService.getPublicClient(chainID)
    const client = await walletClientService.getClient(chainID)
    const kernelAccountAddress = client.account.address

    await publicClient.simulateContract({
      address: kernelAccountAddress,
      abi: KernelExecuteAbi,
      functionName: 'execute',
      args: [permitContract, 0n, permitData, 0],
      account: kernelAccountAddress,
    })

    return {
      response: {
        data: permitData,
        value: 0n,
        to: permitContract,
      },
    }
  }
}
