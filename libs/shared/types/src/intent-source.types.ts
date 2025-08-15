/**
 * Basic IntentSource type to break circular dependencies
 * This is a simplified version of the IntentSource used by analytics
 */
export interface BaseIntentSource {
  chainID: number
  sourceAddress: string
  inbox: string
}

/**
 * Type alias for analytics usage to avoid circular dependencies
 */
export type AnalyticsIntentSource = BaseIntentSource