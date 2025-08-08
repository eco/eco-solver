import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { QuoteDataDTO } from '@/quote/dto/quote-data.dto'
import { QuoteRewardTokensDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteDataEntryDTO } from '@/quote/dto/quote-data-entry.dto'
import { 
  normalizeTokenAmounts, 
  denormalizeTokenAmounts
} from '@/quote/utils/token-normalization.utils'

/**
 * TokenDecimalsInterceptor handles decimal transformations for quote endpoints.
 *
 * This interceptor integrates with @eco-foundation/chains to fetch token decimals from the
 * `stables` field for each chain and handles bidirectional decimal transformations:
 *
 * **Incoming requests**:
 * - Adds `decimals: {original: number, current: number}` field to tokens
 * - Transforms amounts from original decimals to 18 decimals (TARGET_DECIMALS)
 *
 * **Outgoing responses**:
 * - Removes the `decimals` field from tokens
 * - Transforms amounts back from 18 decimals to original decimals
 *
 * The implementation handles decimal transformations transparently:
 * - **Input**: Token amounts are normalized to 18 decimals internally with original decimals tracked
 * - **Output**: Token amounts are converted back to their original decimals and decimals field removed
 * - **Read-only**: The decimals field cannot be set by API callers, only populated server-side
 *
 * The interceptor automatically detects token addresses, looks up their decimals from the
 * @eco-foundation/chains package based on chain IDs extracted from route calls, and handles
 * the transformations bidirectionally.
 */
@Injectable()
export class TokenDecimalsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    // Request body is modified here (synchronous)
    if (request.body) {
      this.transformIncomingTokens(request.body) // Mutates request.body directly
    }

    // Then the handler runs with the modified request body
    return next.handle().pipe(
      map((data) => {
        // Transform outgoing response (asynchronous)
        return this.transformOutgoingTokens(data)
      }),
    )
  }

  private transformIncomingTokens(quoteIntentData: QuoteIntentDataDTO) {
    // Handle QuoteIntentDataDTO structure (incoming request)
    if (quoteIntentData.route && quoteIntentData.reward) {
      if (quoteIntentData.reward.tokens) {
        quoteIntentData.reward.tokens = normalizeTokenAmounts(
          quoteIntentData.reward.tokens,
          Number(quoteIntentData.route.source),
        ) as QuoteRewardTokensDTO[]
      }

      if (quoteIntentData.route.tokens) {
        quoteIntentData.route.tokens = normalizeTokenAmounts(
          quoteIntentData.route.tokens,
          Number(quoteIntentData.route.destination),
        ) as QuoteRewardTokensDTO[]
      }
      return
    }
  }

  private transformOutgoingTokens(quoteData: QuoteDataDTO): any {
    if (!quoteData?.quoteEntries) return quoteData

    quoteData.quoteEntries.forEach((entry: QuoteDataEntryDTO) => {
      if (entry.rewardTokens) {
        // For reward tokens, we can determine the chain from the token itself using decimals metadata
        denormalizeTokenAmounts(entry.rewardTokens)
      }

      if (entry.routeTokens) {
        // For route tokens, we can determine the chain from the token itself using decimals metadata
        denormalizeTokenAmounts(entry.routeTokens)
      }
    })

    return quoteData
  }
}
