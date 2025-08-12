import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { QuoteIntentDataDTO } from '@/quote/dto/quote.intent.data.dto'
import { CallDataInterface } from '@/contracts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { normalizeRouteCalls } from '@/intent/utils/normalize-calls.utils'

/**
 * TokenCallsInterceptor parses route.calls and adds a parsedCalls field with normalized call data.
 *
 * This interceptor:
 * - Parses route.calls byte data to extract ERC20 transfer calls and native calls
 * - Normalizes amounts from original decimals to 18 decimals
 * - Validates that parsed calls match the tokens array
 * - Adds parsedCalls field to the request body for services to use
 *
 * The interceptor uses config-based decimal lookup from @eco-foundation/chains
 * instead of balance service for performance and consistency.
 */
@Injectable()
export class TokenCallsInterceptor implements NestInterceptor {
  constructor(private readonly ecoConfigService: EcoConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()

    // Parse and add calls data to request body (synchronous)
    if (request.body) {
      this.transformIncomingCalls(request.body)
    }

    return next.handle().pipe(
      map((data) => {
        // Remove parsedCalls from outgoing response
        return this.transformOutgoingResponse(data)
      }),
    )
  }

  private transformIncomingCalls(quoteIntentData: QuoteIntentDataDTO) {
    // Handle QuoteIntentDataDTO structure (incoming request)
    if (
      quoteIntentData.route &&
      quoteIntentData.route.calls &&
      quoteIntentData.route.calls.length > 0
    ) {
      const parsedCalls = normalizeRouteCalls(
        {
          calls: quoteIntentData.route.calls as CallDataInterface[],
          chainId: Number(quoteIntentData.route.destination),
          tokens: quoteIntentData.route.tokens || [],
        },
        this.ecoConfigService,
      )

      // Add parsedCalls field to route for services to use
      //@ts-expect-error we add this field for services to use
      quoteIntentData.route.parsedCalls = parsedCalls
    }
  }

  private transformOutgoingResponse(data: any): any {
    // Remove parsedCalls field from any responses if it exists
    if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        return data.map((item) => this.removeParsedCallsFromItem(item))
      } else {
        return this.removeParsedCallsFromItem(data)
      }
    }
    return data
  }

  private removeParsedCallsFromItem(item: any): any {
    if (item && typeof item === 'object') {
      // Remove parsedCalls from top level if it exists
      if ('parsedCalls' in item) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parsedCalls: _parsedCalls, ...rest } = item
        item = rest
      }

      // Remove parsedCalls from route if it exists
      if (item.route && typeof item.route === 'object' && 'parsedCalls' in item.route) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { parsedCalls: _parsedCalls, ...restRoute } = item.route
        item = { ...item, route: restRoute }
      }

      // Handle nested objects that might contain routes with parsedCalls
      if (item.quoteEntries && Array.isArray(item.quoteEntries)) {
        item.quoteEntries = item.quoteEntries.map((entry: any) =>
          this.removeParsedCallsFromItem(entry),
        )
      }
    }
    return item
  }
}
