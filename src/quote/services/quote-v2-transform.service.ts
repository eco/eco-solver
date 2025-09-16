import { decodeFunctionData, erc20Abi, Hex } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable, Logger } from '@nestjs/common'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteV2ContractsDTO } from '@/quote/dto/v2/quote-v2-contracts.dto'
import { QuoteV2FeeDTO } from '@/quote/dto/v2/quote-v2-fee.dto'
import { QuoteV2QuoteResponseDTO } from '@/quote/dto/v2/quote-v2-quote-response.dto'
import { QuoteV2ResponseDTO } from '@/quote/dto/v2/quote-v2-response.dto'
import { PortalHashUtils } from '@/common/utils/portal'
import { randomBytes } from 'crypto'

@Injectable()
export class QuoteV2TransformService {
  private logger = new Logger(QuoteV2TransformService.name)

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  /**
   * Transforms the current quote structure to V2 format
   * @param quoteData The original quote data
   * @param quoteIntent The original quote intent request
   * @returns The transformed V2 quote response
   */
  async transformToV2(
    quoteData: QuoteDataDTO,
    quoteIntent: QuoteIntentDataDTO,
  ): Promise<QuoteV2ResponseDTO | null> {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Transforming quote to V2 format',
        properties: {
          quoteID: quoteIntent.quoteID,
          entriesCount: quoteData.quoteEntries.length,
        },
      }),
    )

    // Take the first valid quote entry
    const quoteEntry = quoteData.quoteEntries[0]
    if (!quoteEntry) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'No quote entries found to transform',
          properties: { quoteID: quoteIntent.quoteID },
        }),
      )
      return null
    }

    try {
      const quoteResponse = await this.buildQuoteResponse(quoteEntry, quoteIntent)
      const contracts = await this.getContractAddresses(quoteIntent)

      return {
        quoteResponse,
        contracts,
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Error transforming quote to V2',
          properties: {
            quoteID: quoteIntent.quoteID,
            error: error.message,
          },
        }),
      )
      throw error
    }
  }

  private async buildQuoteResponse(
    quoteEntry: QuoteDataEntryDTO,
    quoteIntent: QuoteIntentDataDTO,
  ): Promise<QuoteV2QuoteResponseDTO> {
    const sourceChainID = Number(quoteIntent.route.source)
    const destinationChainID = Number(quoteIntent.route.destination)

    // For reverse quotes (V2): reward tokens = what user pays (source), route tokens = what user gets (destination)
    const sourceToken = quoteEntry.rewardTokens[0]?.token || ('0x' as Hex)
    const sourceAmount = quoteEntry.rewardTokens[0]?.amount?.toString() || '0'

    // Extract destination token from route tokens (first token)
    const destinationToken = quoteEntry.routeTokens[0]?.token || ('0x' as Hex)
    const destinationAmount = quoteEntry.routeTokens[0]?.amount?.toString() || '0'

    // For now, we'll use the creator as the funder since there's no funder field in IntentSource
    const funder = quoteIntent.reward.creator
    const refundRecipient = quoteIntent.reward.creator

    // Extract recipient from the first call if it's a transfer
    const recipient = this.extractRecipient(quoteEntry) || quoteIntent.reward.creator

    // Build fees array
    const fees = await this.buildFees(quoteEntry, quoteIntent)

    // Convert expiry time to UNIX seconds
    const deadline = parseInt(quoteEntry.expiryTime)

    // Build the complete route structure needed for encoding
    // The route from quoteIntent needs additional fields for the Portal contract
    const salt = ('0x' + randomBytes(32).toString('hex')) as Hex
    const completeRoute = {
      salt, // Random 32-byte salt
      deadline: BigInt(deadline), // Use the quote deadline
      portal: quoteIntent.route.inbox, // The inbox is the portal on destination chain
      nativeAmount: 0n, // Default to 0 for quotes
      tokens: quoteIntent.route.tokens.map((t) => ({
        token: t.token,
        amount: BigInt(t.amount),
      })),
      calls: quoteIntent.route.calls.map((c) => ({
        target: c.target,
        data: c.data,
        value: BigInt(c.value),
      })),
    }

    // Build and encode the route using PortalHashUtils
    const encodedRoute = PortalHashUtils.getEncodedRoute(completeRoute)

    return {
      intentExecutionType: quoteEntry.intentExecutionType,
      sourceChainID,
      destinationChainID,
      sourceToken,
      destinationToken,
      sourceAmount,
      destinationAmount,
      funder,
      refundRecipient,
      recipient,
      fees,
      deadline,
      estimatedFulfillTimeSec: quoteEntry.estimatedFulfillTimeSec,
      encodedRoute,
    }
  }

  private extractRecipient(quoteEntry: QuoteDataEntryDTO): Hex | null {
    // Try to extract recipient from the first call's data
    // This assumes the call is an ERC20 transfer
    const firstCall = quoteEntry.routeCalls[0]
    if (!firstCall) return null

    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: firstCall.data })
      if (decoded.functionName === 'transfer') return decoded.args[0]
      if (decoded.functionName === 'transferFrom') return decoded.args[1]
    } catch (error) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'Could not extract recipient from call data',
          properties: { error: error.message },
        }),
      )
    }

    return null
  }

  private async buildFees(
    quoteEntry: QuoteDataEntryDTO,
    quoteIntent: QuoteIntentDataDTO,
  ): Promise<QuoteV2FeeDTO[]> {
    const fees: QuoteV2FeeDTO[] = []

    // For V2 reverse quotes: calculate fee as source amount - destination amount
    const sourceAmount = quoteEntry.rewardTokens[0]?.amount || 0n
    const destinationAmount = quoteEntry.routeTokens[0]?.amount || 0n
    const feeAmount = sourceAmount > destinationAmount ? sourceAmount - destinationAmount : 0n

    if (feeAmount > 0n) {
      // Get token info from the source token (what user pays)
      const token = quoteEntry.rewardTokens[0]?.token || ('0x' as Hex)
      const tokenInfo = await this.getTokenInfo(token, Number(quoteIntent.route.source))

      fees.push({
        name: 'Eco Protocol Fee',
        description: 'Fee for processing the intent through Eco Protocol',
        token: tokenInfo,
        amount: feeAmount.toString(),
      })
    }

    // Add gas overhead fee if present
    if (quoteEntry.rewardNative > 0n) {
      const nativeTokenInfo = await this.getNativeTokenInfo(Number(quoteIntent.route.source))

      fees.push({
        name: 'Gas Fee',
        description: 'Estimated gas cost for transaction execution',
        token: nativeTokenInfo,
        amount: quoteEntry.rewardNative.toString(),
      })
    }

    return fees
  }

  private async getTokenInfo(
    tokenAddress: Hex,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _chainId: number,
  ): Promise<{ address: Hex; decimals: number; symbol: string }> {
    // In a real implementation, this would fetch token info from chain or config
    // For now, returning placeholder data
    return {
      address: tokenAddress,
      decimals: 18, // Default to 18 decimals
      symbol: 'TOKEN', // Placeholder symbol
    }
  }

  private async getNativeTokenInfo(
    chainId: number,
  ): Promise<{ address: Hex; decimals: number; symbol: string }> {
    // Get native token info based on chain
    const chainConfig = this.ecoConfigService.getChain(chainId)

    return {
      address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Hex, // Standard native token address
      decimals: 18,
      symbol: chainConfig?.nativeCurrency?.symbol || 'ETH',
    }
  }

  private async getContractAddresses(
    quoteIntent: QuoteIntentDataDTO,
  ): Promise<QuoteV2ContractsDTO> {
    const sourceChain = Number(quoteIntent.route.source)

    // Get intent source contract for source chain
    const sourceConfig = this.ecoConfigService.getIntentSource(sourceChain)
    const intentSource =
      sourceConfig?.sourceAddress || ('0x0000000000000000000000000000000000000000' as Hex)

    // Get prover address from reward
    const prover = quoteIntent.reward.prover

    // Get inbox from route
    const inbox = quoteIntent.route.inbox

    return {
      sourcePortal: intentSource,
      prover,
      destinationPortal: inbox,
    }
  }
}
