import { EcoError } from '../../common/errors/eco-error'
import { EcoLogMessage } from '../../common/logging/eco-log-message'
import { EcoResponse } from '../../common/eco-response'
import { encodeFunctionData, Hex, TransactionReceipt } from 'viem'
import { ExecuteSmartWalletArg } from '../../transaction/smart-wallets/smart-wallet.types'
import { GaslessIntentRequestDTO } from '../../quote/dto/gasless-intent-request.dto'
import { getChainConfig } from '../../eco-configs/utils'
import { hashRoute, RouteType } from '@eco-foundation/routes-ts'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { ModuleRef } from '@nestjs/core'
import { Permit2DTO } from '../../quote/dto/permit2/permit2.dto'
import { Permit2Processor } from '../../permit-processing/permit2-processor'
import { PermitDTO } from '../../quote/dto/permit/permit.dto'
import { PermitProcessingParams } from '../../permit-processing/interfaces/permit-processing-params.interface'
import { PermitProcessor } from '../../permit-processing/permit-processor'
import { QuoteService } from '../../quote/quote.service'
import { RewardDTO } from '../../quote/dto/reward.dto'
import * as _ from 'lodash'

export const ZERO_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000'

@Injectable()
export class IntentInitiationService implements OnModuleInit {
  private logger = new Logger(IntentInitiationService.name)
  private quoteService: QuoteService
  private permitProcessor: PermitProcessor
  private permit2Processor: Permit2Processor
  private kernelAccountClientService: KernelAccountClientService

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    this.quoteService = this.moduleRef.get(QuoteService, { strict: false })
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
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `createGaslessIntent`,
        properties: {
          gaslessIntentRequestDTO,
        },
      }),
    )

    // Get the permit tx(s)
    const { response: permitTxs, error } = this.generatePermitTxs(gaslessIntentRequestDTO)

    if (error) {
      return { error }
    }

    // Get the fundFor tx
    const { response: fundForTx, error: fundForTxError } =
      await this.getIntentFundForTx(gaslessIntentRequestDTO)

    if (fundForTxError) {
      return { error: fundForTxError }
    }

    const allTxs = [...permitTxs!, fundForTx!]
    const { originChainID } = gaslessIntentRequestDTO

    const kernelAccountClient = await this.kernelAccountClientService.getClient(originChainID)
    const txHash = await kernelAccountClient.execute(allTxs)
    const receipt = await kernelAccountClient.waitForTransactionReceipt({ hash: txHash })

    return { response: receipt }
  }

  /**
   * This function is used to get the fund transaction for the gasless intent.
   * It fetches the quote using the bogus zero hash and then gets the route hash with the real salt.
   * @param gaslessIntentRequestDTO
   * @param salt
   * @returns
   */
  private async getIntentFundForTx(
    gaslessIntentRequestDTO: GaslessIntentRequestDTO,
  ): Promise<EcoResponse<ExecuteSmartWalletArg>> {
    // First fetch the quote using the bogus zero hash
    const { salt, route: quoteRoute } = gaslessIntentRequestDTO
    const route: RouteType = {
      salt: ZERO_SALT,
      ...quoteRoute,
    }

    const routeHash = hashRoute(route)
    const quote = await this.quoteService.fetchQuoteIntentData({ routeHash })

    if (!quote) {
      return { error: EcoError.QuoteNotFound }
    }

    // Now we need to get the route hash with the real salt
    const routeWithSalt: RouteType = {
      salt,
      ...quoteRoute,
    }

    const realRouteHash = hashRoute(routeWithSalt)
    const chainConfig = getChainConfig(gaslessIntentRequestDTO.originChainID)
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
      quote.reward,
      gaslessIntentRequestDTO.getFunder!(),
      gaslessIntentRequestDTO.getPermitContractAddress!(),
      false,
    ] as const

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
      originChainID,
      reward,

      gaslessIntentData: {
        funder,
        permitData: { permit, permit2 },
      },
    } = gaslessIntentRequestDTO

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `processPermitCalls: permits`,
        properties: {
          permit: permit || 'N/A',
          permit2: permit2 || 'N/A',
        },
      }),
    )

    if (_.size(permit) > 0) {
      return this.getPermitTxs(originChainID, permit!, funder, reward)
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
    reward: RewardDTO,
  ): EcoResponse<ExecuteSmartWalletArg[]> {
    const chainConfig = getChainConfig(originChainID)
    const intentSourceContract = chainConfig.IntentSource
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
          spender: intentSourceContract,
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
