import { encodeFunctionData, erc20Abi, Hex, zeroAddress } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { ProofService } from '@/prover/proof.service'
import { QuoteRewardDataDTO, QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteRouteDataDTO } from '@/quote/dto/quote.route.data.dto'
import { QuoteV2RequestDTO } from '@/quote/dto/v2/quote-v2-request.dto'

@Injectable()
export class ReverseQuoteRequestTransformer {
  private logger = new Logger(ReverseQuoteRequestTransformer.name)

  constructor(private readonly proofService: ProofService) {}

  createRouteData(v2Request: QuoteV2RequestDTO, inbox: Hex): QuoteRouteDataDTO {
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

  createRewardData(v2Request: QuoteV2RequestDTO, prover: Hex): QuoteRewardDataDTO {
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
}
