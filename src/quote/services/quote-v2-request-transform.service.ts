import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { encodeFunctionData, erc20Abi, Hex, zeroAddress } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { ProofService } from '@/prover/proof.service'
import { QuoteError } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteRewardDataDTO, QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'

const MAX_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

@Injectable()
export class QuoteV2RequestTransformService {
  private logger = new Logger(QuoteV2RequestTransformService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly proofService: ProofService,
  ) {}

  /**
   * Reverse: user offers `sourceAmount`, solver decides how much dest token
   */
  transformToQuoteIntentReverse(v2Request: QuoteV2RequestDTO): EcoResponse<QuoteIntentDataDTO> {
    try {
      const { quoteID, dAppID, intentExecutionTypes, quoteRequest, contracts } = v2Request
      this.logger.log(`Transforming V2 request (reverse) for ${dAppID}`)

      this.validateContracts(quoteRequest.sourceChainID, quoteRequest.destinationChainID, contracts)

      const sourceConfig = this.ecoConfigService.getIntentSource(quoteRequest.sourceChainID)
      const destinationConfig = this.ecoConfigService.getSolver(quoteRequest.destinationChainID)

      if (!sourceConfig || !destinationConfig) {
        throw new Error(`Missing source or destination config`)
      }

      const prover = sourceConfig.provers?.[0] || zeroAddress

      const reward = this.createRewardDataReverse(v2Request, prover)
      const route = this.createRouteDataReverse(v2Request, destinationConfig.inboxAddress)

      const quoteIntentData: QuoteIntentDataDTO = {
        quoteID,
        dAppID,
        intentExecutionTypes,
        route,
        reward,
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `transformToQuoteIntentReverse: quoteIntentData:`,
          properties: {
            quoteIntentData,
          },
        }),
      )

      return { response: quoteIntentData }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `transformToQuoteIntentReverse: Error transforming V2 request:`,
          properties: {
            error: ex.message,
            dAppID: v2Request.dAppID,
          },
        }),
      )

      return { error: EcoError.InvalidQuoteV2Request(ex.message) }
    }
  }

  /**
   * Forward: user wants an exact `destinationAmount`, solver decides required `sourceAmount`
   */
  transformToQuoteIntentForward(v2Request: QuoteV2RequestDTO): EcoResponse<QuoteIntentDataDTO> {
    try {
      const { quoteID, dAppID, intentExecutionTypes, quoteRequest, contracts } = v2Request
      this.logger.log(`Transforming V2 request (forward) for ${dAppID}`)

      this.validateContracts(quoteRequest.sourceChainID, quoteRequest.destinationChainID, contracts)

      const sourceConfig = this.ecoConfigService.getIntentSource(quoteRequest.sourceChainID)
      const destinationConfig = this.ecoConfigService.getSolver(quoteRequest.destinationChainID)

      if (!sourceConfig || !destinationConfig) {
        throw new Error(`Missing source or destination config`)
      }

      const prover = sourceConfig.provers?.[0] || zeroAddress

      // Forward: reward = what the solver demands on source side
      // But at transform time, we don’t yet know it, so seed with *zero* and let solver fill
      const reward = this.createRewardDataForward(v2Request, prover)

      const route = this.createRouteDataForward(v2Request, destinationConfig.inboxAddress)

      const quoteIntentData: QuoteIntentDataDTO = {
        quoteID,
        dAppID,
        intentExecutionTypes,
        route,
        reward,
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `transformToQuoteIntentForward: quoteIntentData:`,
          properties: {
            quoteIntentData,
          },
        }),
      )

      return { response: quoteIntentData }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `transformToQuoteIntentForward: Error transforming V2 request:`,
          properties: {
            error: ex.message,
            dAppID: v2Request.dAppID,
          },
        }),
      )

      return { error: EcoError.InvalidQuoteV2Request(ex.message) }
    }
  }

  private createRewardDataReverse(v2Request: QuoteV2RequestDTO, prover: Hex): QuoteRewardDataDTO {
    const { quoteRequest } = v2Request
    const isNative = quoteRequest.sourceToken === zeroAddress
    const sourceAmount = BigInt(quoteRequest.sourceAmount)

    const tokens: QuoteRewardTokensDTO[] = isNative
      ? []
      : [{ token: quoteRequest.sourceToken, amount: sourceAmount }]

    const nativeValue = isNative ? sourceAmount : 0n

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

  private createRewardDataForward(v2Request: QuoteV2RequestDTO, prover: Hex): QuoteRewardDataDTO {
    const { quoteRequest } = v2Request
    const isNative = quoteRequest.sourceToken === zeroAddress

    // Deadline exactly as before
    const proverType = this.proofService.getProverType(quoteRequest.sourceChainID, prover)
    if (!proverType) throw new Error('No intent prover type')
    const deadlineBuffer = this.proofService.getProofMinimumDate(proverType)
    const TEN_MINUTES = 600
    const deadline = BigInt(Math.floor(deadlineBuffer.getTime() / 1000) + TEN_MINUTES)

    // In forward quotes:
    // - amounts are unknown -> set to 0n (solver will fill them)
    // - token identity MUST be provided so solver knows what it can pull
    const tokens = isNative
      ? [] // native reward: keep in nativeValue (still 0 for quote stage)
      : [{ token: quoteRequest.sourceToken, amount: MAX_BIGINT }]

    return {
      creator: quoteRequest.funder,
      prover,
      deadline,
      nativeValue: isNative ? 0n : 0n, // always 0 at quote stage
      tokens,
    }
  }

  private createRouteDataReverse(v2Request: QuoteV2RequestDTO, inbox: Hex): QuoteRouteDataDTO {
    const { quoteRequest } = v2Request
    const isNativeDestination = quoteRequest.destinationToken === zeroAddress

    const tokens: QuoteRewardTokensDTO[] = isNativeDestination
      ? []
      : [{ token: quoteRequest.destinationToken, amount: BigInt(quoteRequest.sourceAmount) }]

    const calls = isNativeDestination
      ? [
          {
            target: quoteRequest.recipient,
            data: '0x' as Hex,
            value: BigInt(quoteRequest.sourceAmount),
          },
        ]
      : [
          {
            target: quoteRequest.destinationToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [quoteRequest.recipient, 0n], // solver fills
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

  private createRouteDataForward(v2Request: QuoteV2RequestDTO, inbox: Hex): QuoteRouteDataDTO {
    const { quoteRequest } = v2Request
    const isNativeDestination = quoteRequest.destinationToken === zeroAddress

    const tokens = isNativeDestination
      ? []
      : [{ token: quoteRequest.destinationToken, amount: BigInt(quoteRequest.sourceAmount) }]

    const calls = isNativeDestination
      ? [
          {
            target: quoteRequest.recipient,
            data: '0x' as Hex,
            value: BigInt(quoteRequest.sourceAmount),
          },
        ]
      : [
          {
            target: quoteRequest.destinationToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [quoteRequest.recipient, BigInt(quoteRequest.sourceAmount)],
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
