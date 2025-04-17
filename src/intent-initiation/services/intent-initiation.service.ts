import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { encodeFunctionData, Hex, TransactionReceipt } from 'viem'
import { EstimatedGasDataForIntentInitiation } from '@/intent-initiation/interfaces/estimated-gas-data-for-intent-initiation.interface'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { getChainConfig } from '@/eco-configs/utils'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { InternalQuoteError } from '@/quote/errors'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { ModuleRef } from '@nestjs/core'
import { Permit2DTO } from '@/quote/dto/permit2/permit2.dto'
import { Permit2Processor } from '@/permit-processing/permit2-processor'
import { PermitDTO } from '@/quote/dto/permit/permit.dto'
import { PermitProcessingParams } from '@/permit-processing/interfaces/permit-processing-params.interface'
import { PermitProcessor } from '@/permit-processing/permit-processor'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { RouteType, hashRoute, IntentSourceAbi } from '@eco-foundation/routes-ts'
import * as _ from 'lodash'

@Injectable()
export class IntentInitiationService implements OnModuleInit {
  private logger = new EcoLogger(IntentInitiationService.name)
  private quoteRepository: QuoteRepository
  private permitProcessor: PermitProcessor
  private permit2Processor: Permit2Processor
  private kernelAccountClientService: KernelAccountClientService

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.quoteRepository = this.moduleRef.get(QuoteRepository, { strict: false })
    this.permitProcessor = this.moduleRef.get(PermitProcessor, { strict: false })
    this.permit2Processor = this.moduleRef.get(Permit2Processor, { strict: false })
    this.kernelAccountClientService = this.moduleRef.get(KernelAccountClientService, {
      strict: false,
    })
  }

  /**
   * This function is used to initiate a gasless intent. It generates the permit transactions and fund transaction.
   * @param gaslessIntentRequestDTO
   * @returns
   */
  async initiateGaslessIntent(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<TransactionReceipt>> {
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
  ): Promise<EcoResponse<TransactionReceipt>> {
    gaslessIntentRequestDTO = GaslessIntentRequestDTO.fromJSON(gaslessIntentRequestDTO)

    // Get all the txs
    const { response: allTxs, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequestDTO)

    if (error) {
      return { error }
    }

    const kernelAccountClient = await this.kernelAccountClientService.getClient(
      gaslessIntentRequestDTO.getSourceChainID!(),
    )

    const txHash = await kernelAccountClient.execute(allTxs!)
    const receipt = await kernelAccountClient.waitForTransactionReceipt({ hash: txHash })

    return { response: receipt }
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
    // fromJSON does a plainToInstance on the POJO to make it into a class instance with methods
    gaslessIntentRequest = GaslessIntentRequestDTO.fromJSON(gaslessIntentRequest)

    // Generate the actual txs (permit(s) + fundFor)
    const { response: allTxs, error } =
      await this.generateGaslessIntentTransactions(gaslessIntentRequest)

    if (error) {
      return { error }
    }

    try {
      const chainID = gaslessIntentRequest.getSourceChainID!()
      const { response: estimatedGasData, error: estimateError } =
        await this.kernelAccountClientService.estimateGasForKernelExecution(chainID, allTxs!)

      if (estimateError) {
        return { error: estimateError }
      }

      const { gasEstimate: estimatedGasInWei, gasPrice } = estimatedGasData!

      // Apply a buffer (e.g., 10%)
      const buffer = BigInt(Math.floor((Number(estimatedGasInWei) * bufferPercent) / 100))
      const totalWithBuffer = estimatedGasInWei + buffer
      const gasCost = totalWithBuffer * gasPrice

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `calculateGasQuoteForIntent: estimated gas details`,
          properties: {
            estimatedGas: estimatedGasInWei,
            price: gasPrice,
            totalCost: gasCost,
          },
        }),
      )

      return {
        response: {
          gasEstimate: estimatedGasInWei,
          gasPrice,
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
  ): Promise<EcoResponse<ExecuteSmartWalletArg[]>> {
    gaslessIntentRequestDTO = GaslessIntentRequestDTO.fromJSON(gaslessIntentRequestDTO)

    // Get the fundFor tx
    const { response: fundForTx, error: fundForTxError } =
      await this.getIntentFundForTx(gaslessIntentRequestDTO)

    if (fundForTxError) {
      return { error: InternalQuoteError(fundForTxError) }
    }

    // Get the permit tx(s)
    const { response: permitTxs, error } = this.generatePermitTxs(gaslessIntentRequestDTO)

    if (error) {
      return { error: InternalQuoteError(error) }
    }

    return { response: [...permitTxs!, fundForTx!] }
  }

  /**
   * This function is used to get the set of transactions for the gasless intent.
   * These comprise the fundFor tx as well as the permit/permit2 txs.
   * @param gaslessIntentRequestDTO
   * @param salt
   * @returns
   */
  private async getIntentFundForTx(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<ExecuteSmartWalletArg>> {
    const { quoteID, salt, route: quoteRoute } = gaslessIntentRequestDTO

    const { response: quote, error } = await this.quoteRepository.fetchQuoteIntentData({
      quoteID,
      intentExecutionType: IntentExecutionType.GASLESS.toString(),
    })

    if (error) {
      return { error }
    }

    // Now we need to get the route hash with the real salt
    const routeWithSalt: RouteType = {
      ...quoteRoute,
      salt,
    }

    const realRouteHash = hashRoute(routeWithSalt)
    const chainConfig = getChainConfig(gaslessIntentRequestDTO.getSourceChainID!())
    const intentSourceContract = chainConfig.IntentSource

    // function fundFor(
    //   bytes32 routeHash,
    //   Reward calldata reward,
    //   address funder,
    //   address permitContact,
    //   bool allowPartial
    // )

    const args = [
      realRouteHash,
      quote!.reward,
      gaslessIntentRequestDTO.getFunder!(),
      gaslessIntentRequestDTO.getPermitContractAddress!(),
      false,
    ] as const

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getIntentFundForTx: encodeFunctionData args:`,
        properties: {
          routeHash: realRouteHash,
          reward: quote!.reward,
          funder: gaslessIntentRequestDTO.getFunder!(),
          permitContact: gaslessIntentRequestDTO.getPermitContractAddress!(),
          allowPartial: false,
        },
      }),
    )

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

  private generatePermitTxs(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): EcoResponse<ExecuteSmartWalletArg[]> {
    const {
      reward,
      gaslessIntentData: { funder, permitData, vaultAddress },
    } = gaslessIntentRequestDTO

    if (_.size(permitData) === 0) {
      return { response: [] }
    }

    const { permit, permit2 } = permitData!

    if (_.size(permit) > 0) {
      return this.getPermitTxs(
        gaslessIntentRequestDTO.getSourceChainID!(),
        permit!,
        funder,
        reward,
        vaultAddress!,
      )
    }

    if (_.size(permit2) > 0) {
      return this.getPermit2Txs(permit2!)
    }

    return { error: EcoError.NoPermitsProvided }
  }

  private getPermitTxs(
    originChainID: number,
    permits: PermitDTO[],
    funder: Hex,
    reward: QuoteRewardDataDTO,
    vaultAddress: Hex,
  ): EcoResponse<ExecuteSmartWalletArg[]> {
    const permitMap: Record<string, PermitDTO> = {}

    for (const permit of permits) {
      permitMap[permit.token.toLowerCase()] = permit
    }

    // Iterate over the reward tokens and call permit on that token contract if there exists a permit with a matching token address
    const { tokens } = reward
    const executions: PermitProcessingParams[] = []

    for (const token of tokens) {
      const tokenPermit = permitMap[token.token.toLowerCase()]

      if (tokenPermit) {
        executions.push({
          permit: tokenPermit,
          chainID: originChainID,
          owner: funder,
          spender: vaultAddress,
          value: BigInt(token.amount),
        })
      }
    }

    return this.permitProcessor.generateTxs(...executions)
  }

  private getPermit2Txs(permit2DTO: Permit2DTO): EcoResponse<ExecuteSmartWalletArg[]> {
    return this.permit2Processor.generateTxs(permit2DTO)
  }
}
