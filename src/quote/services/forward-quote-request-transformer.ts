import { encodeFunctionData, erc20Abi, Hex, zeroAddress } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { ProofService } from '@/prover/proof.service'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'

const MAX_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

@Injectable()
export class ForwardQuoteRequestTransformer {
  private logger = new Logger(ForwardQuoteRequestTransformer.name)

  constructor(private readonly proofService: ProofService) {}

  createRouteDataForward(v2Request: QuoteV2RequestDTO, inbox: Hex): QuoteRouteDataDTO {
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

  createRewardDataForward(v2Request: QuoteV2RequestDTO, prover: Hex): QuoteRewardDataDTO {
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
}
