import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { ForwardQuoteRequestTransformer } from '@/quote/services/forward-quote-request-transformer'
import { getChainConfig } from '@/eco-configs/utils'
import { Hex, zeroAddress } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { QuoteError } from '@/quote/errors'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'
import { ReverseQuoteRequestTransformer } from '@/quote/services/reverse-quote-request-transformer'

/**
 * Chain IDs that require CCIP prover for cross-chain messaging
 */
const CCIP_PROVER_CHAIN_IDS = [2020] // Ronin

@Injectable()
export class QuoteV2RequestTransformService {
  private logger = new Logger(QuoteV2RequestTransformService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly forwardTransformer: ForwardQuoteRequestTransformer,
    private readonly reverseTransformer: ReverseQuoteRequestTransformer,
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

      const prover = this.selectProver(quoteRequest.sourceChainID, quoteRequest.destinationChainID)

      const reward = this.reverseTransformer.createRewardData(v2Request, prover)
      const route = this.reverseTransformer.createRouteData(
        v2Request,
        destinationConfig.inboxAddress,
      )

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

      const prover = this.selectProver(quoteRequest.sourceChainID, quoteRequest.destinationChainID)

      // Forward: reward = what the solver demands on source side
      // But at transform time, we don’t yet know it, so seed with *zero* and let solver fill
      const reward = this.forwardTransformer.createRewardData(v2Request, prover)

      const route = this.forwardTransformer.createRouteData(
        v2Request,
        destinationConfig.inboxAddress,
      )

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

  /**
   * Selects the appropriate prover based on source and destination chain IDs.
   * Proving always happens on the destination chain, so the prover address
   * is always retrieved from the destination chain config.
   * Some chains require specific provers (e.g., CCIP for Ronin).
   *
   * @param sourceChainID - The source chain ID
   * @param destinationChainID - The destination chain ID
   * @returns The selected prover address
   * @throws Error if route requires CCIP but no CCIP prover is available
   */
  private selectProver(sourceChainID: number, destinationChainID: number): Hex {
    const destinationChainConfig = getChainConfig(destinationChainID)
    const routeRequiresCcip =
      CCIP_PROVER_CHAIN_IDS.includes(sourceChainID) ||
      CCIP_PROVER_CHAIN_IDS.includes(destinationChainID)

    // If either chain requires CCIP, we must use CCIP prover or fail
    if (routeRequiresCcip) {
      if (!destinationChainConfig.CcipProver || destinationChainConfig.CcipProver === zeroAddress) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Route requires CCIP prover but none is configured on destination chain`,
            properties: {
              sourceChainID,
              destinationChainID,
            },
          }),
        )
        throw new Error(
          `Route requires CCIP prover but none is configured on destination chain ${destinationChainID}`,
        )
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Using CCIP prover for route`,
          properties: {
            sourceChainID,
            destinationChainID,
            prover: destinationChainConfig.CcipProver,
          },
        }),
      )
      return destinationChainConfig.CcipProver as Hex
    }

    // Default: return first available prover from destination chain config
    // Priority: HyperProver > MetaProver > CcipProver (filtered by non-zero)
    const availableProvers = [
      destinationChainConfig.HyperProver,
      destinationChainConfig.MetaProver,
      destinationChainConfig.CcipProver,
    ].filter((prover) => prover && prover !== zeroAddress)

    if (availableProvers.length === 0) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `No provers available for destination chain`,
          properties: {
            sourceChainID,
            destinationChainID,
          },
        }),
      )
      throw new Error(`No provers available for destination chain ${destinationChainID}`)
    }

    return availableProvers[0] as Hex
  }
}
