import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { encodeFunctionData, erc20Abi, Hex, parseUnits, zeroAddress } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { IntentExecutionType } from '@/quote/enums/intent-execution-type.enum'
import { ProofService } from '@/prover/proof.service'
import { QuoteError } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRewardDataDTO, QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { randomUUID } from 'crypto'

@Injectable()
export class QuoteV2RequestTransformService {
  private logger = new Logger(QuoteV2RequestTransformService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly proofService: ProofService,
  ) {}

  /**
   * Transforms a V2 quote request into the QuoteIntentDataDTO format expected by the reverse quote service
   * @param v2Request The V2 quote request
   * @returns The transformed QuoteIntentDataDTO
   */
  transformToQuoteIntent(v2Request: QuoteV2RequestDTO): QuoteIntentDataDTO {
    const { dAppID, quoteRequest, contracts, gaslessIntentData } = v2Request

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Transforming V2 request to QuoteIntentDataDTO',
        properties: {
          dAppID,
          sourceChainID: quoteRequest.sourceChainID,
          destinationChainID: quoteRequest.destinationChainID,
          sourceToken: quoteRequest.sourceToken,
          sourceAmount: quoteRequest.sourceAmount,
        },
      }),
    )

    // Validate and warn if provided contracts don't match configuration
    this.validateContracts(quoteRequest.sourceChainID, quoteRequest.destinationChainID, contracts)

    // Get contracts from configuration (always use these, ignore request contracts)
    const sourceConfig = this.ecoConfigService.getIntentSource(quoteRequest.sourceChainID)
    const destinationConfig = this.ecoConfigService.getSolver(quoteRequest.destinationChainID)

    if (!sourceConfig) {
      throw new Error(
        `No intent source configuration found for chain ${quoteRequest.sourceChainID}`,
      )
    }

    if (!destinationConfig) {
      throw new Error(`No solver configuration found for chain ${quoteRequest.destinationChainID}`)
    }

    // Get prover from source config - use the first prover if available
    const prover =
      sourceConfig.provers?.[0] || ('0x0000000000000000000000000000000000000000' as Hex)

    // Create reward data (this is what the user is paying with - source side)
    const reward = this.createRewardData(v2Request, prover)

    // Create route data (this is what will be executed - destination side)
    const route = this.createRouteData(v2Request, destinationConfig.inboxAddress)

    // Generate a quote ID
    const quoteID = randomUUID()

    // Determine the intent execution type, based on whether gaslessIntentData was provided
    const intentExecutionType = gaslessIntentData
      ? IntentExecutionType.GASLESS
      : IntentExecutionType.SELF_PUBLISH

    const quoteIntentData: QuoteIntentDataDTO = {
      quoteID,
      dAppID,
      intentExecutionTypes: [intentExecutionType.toString()],
      route,
      reward,
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Transformed V2 request to QuoteIntentDataDTO',
        properties: {
          quoteID,
          dAppID,
          isNativeSource: quoteRequest.sourceToken === zeroAddress,
          isNativeDestination: quoteRequest.destinationToken === zeroAddress,
        },
      }),
    )

    return quoteIntentData
  }

  private createRewardData(v2Request: QuoteV2RequestDTO, prover: Hex): QuoteRewardDataDTO {
    const { quoteRequest } = v2Request
    const isNative = quoteRequest.sourceToken === zeroAddress
    const sourceAmount = BigInt(quoteRequest.sourceAmount)

    // For reverse quotes, the reward is what the user is offering
    const tokens: QuoteRewardTokensDTO[] = isNative
      ? [] // Native tokens don't go in the tokens array
      : [
          {
            token: quoteRequest.sourceToken,
            amount: sourceAmount,
          },
        ]

    const nativeValue = isNative ? sourceAmount : 0n

    // Set deadline to 30 minutes from now
    const proverType = this.proofService.getProverType(quoteRequest.sourceChainID, prover)
    if (!proverType) throw new Error('No intent prover type')
    const deadlineBuffer = this.proofService.getProofMinimumDate(proverType)

    const TEN_MINUTES = 600
    const deadline = BigInt(Math.floor(deadlineBuffer.getTime() / 1000) + TEN_MINUTES)

    return {
      creator: quoteRequest.funder,
      prover,
      deadline,
      nativeValue,
      tokens,
    }
  }

  private createRouteData(v2Request: QuoteV2RequestDTO, inbox: Hex): QuoteRouteDataDTO {
    const { quoteRequest } = v2Request
    const isNativeDestination = quoteRequest.destinationToken === zeroAddress

    // For reverse quotes, we start with an empty route that will be filled by the service
    // We only specify the destination token we want to receive
    const tokens = isNativeDestination
      ? []
      : [
          {
            token: quoteRequest.destinationToken,
            amount: parseUnits(quoteRequest.sourceAmount, 6),
          },
        ]

    // Create a transfer call to the recipient
    // This will be updated by the reverse quote service based on what can be fulfilled
    const calls = isNativeDestination
      ? [
          {
            target: quoteRequest.recipient,
            data: '0x' as Hex,
            value: parseUnits(quoteRequest.sourceAmount, 18),
          },
        ]
      : [
          {
            target: quoteRequest.destinationToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [quoteRequest.recipient, 0n], // Amount will be set by reverse quote
            }),
            value: 0n,
          },
        ]

    return {
      source: BigInt(quoteRequest.sourceChainID),
      destination: BigInt(quoteRequest.destinationChainID),
      inbox,
      tokens,
      calls,
    }
  }

  private validateContracts(
    sourceChainID: number,
    destinationChainID: number,
    contracts?: {
      intentSource?: Hex
      prover?: Hex
      inbox?: Hex
    },
  ): void {
    if (!contracts) return

    const sourceConfig = this.ecoConfigService.getIntentSource(sourceChainID)
    const destinationConfig = this.ecoConfigService.getSolver(destinationChainID)

    if (contracts.intentSource && sourceConfig?.sourceAddress !== contracts.intentSource) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Provided intentSource does not match configuration',
          properties: {
            provided: contracts.intentSource,
            configured: sourceConfig?.sourceAddress,
            chainID: sourceChainID,
          },
        }),
      )

      throw QuoteError.UnsupportedContract('IntentSource', contracts.intentSource)
    }

    if (
      contracts.prover &&
      sourceConfig?.provers &&
      !sourceConfig.provers.includes(contracts.prover)
    ) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Provided prover is not in configuration',
          properties: {
            provided: contracts.prover,
            configured: sourceConfig?.provers,
            chainID: sourceChainID,
          },
        }),
      )

      throw QuoteError.UnsupportedContract('Prover', contracts.prover)
    }

    if (contracts.inbox && destinationConfig?.inboxAddress !== contracts.inbox) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'Provided inbox does not match configuration',
          properties: {
            provided: contracts.inbox,
            configured: destinationConfig?.inboxAddress,
            chainID: destinationChainID,
          },
        }),
      )

      throw QuoteError.UnsupportedContract('Inbox', contracts.inbox)
    }
  }
}
