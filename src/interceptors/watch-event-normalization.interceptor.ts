import { Injectable } from '@nestjs/common'
import { IntentCreatedLog } from '@/contracts'
import { normalizeTokenAmounts } from '@/quote/utils/token-normalization.utils'

/**
 * WatchEventNormalizationInterceptor handles decimal normalization for on-chain event data
 * before it enters Redis queues or database storage.
 *
 * This interceptor ensures that all token amounts from blockchain events are normalized
 * to BASE_DECIMALS (18) consistently, similar to how the TokenDecimalsInterceptor handles
 * quote API endpoints.
 *
 * Key responsibilities:
 * - Normalize token amounts in IntentCreatedLog events
 * - Add decimal metadata to track original decimals
 * - Ensure consistent decimal representation across watch module data flow
 */
@Injectable()
export class WatchEventNormalizationInterceptor {
  /**
   * Normalizes IntentCreated event data before Redis queue processing
   */
  normalizeIntentCreatedLog(log: IntentCreatedLog, sourceChainId: number): IntentCreatedLog {
    if (!log.args) return log

    const normalizedLog = { ...log }

    // Normalize reward token amounts if present
    if (log.args.rewardTokens && log.args.rewardTokens.length > 0) {
      normalizedLog.args = {
        ...log.args,
        rewardTokens: normalizeTokenAmounts(log.args.rewardTokens as any[], sourceChainId) as any,
      }
    }

    // Normalize route token amounts if present (destination chain tokens)
    if (log.args.routeTokens && log.args.routeTokens.length > 0) {
      normalizedLog.args = {
        ...normalizedLog.args,
        routeTokens: normalizeTokenAmounts(
          log.args.routeTokens as any[],
          Number(log.args.destination),
        ) as any,
      }
    }

    return normalizedLog
  }
}
