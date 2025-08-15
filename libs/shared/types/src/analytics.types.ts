/**
 * Basic types for analytics to avoid circular dependencies
 * These are minimal type definitions for tracking purposes
 */

/**
 * Basic intent source model for analytics
 */
export interface AnalyticsIntentModel {
  _id?: any
  intentHash: string
  status?: string
  createdAt?: Date
  updatedAt?: Date
  [key: string]: any // Allow additional properties for flexibility
}

/**
 * Basic solver model for analytics
 */
export interface AnalyticsSolver {
  id?: string
  address?: string
  type?: string
  [key: string]: any // Allow additional properties for flexibility
}

/**
 * Basic model interface for analytics tracking
 */
export interface AnalyticsModel {
  _id?: any
  [key: string]: any // Allow additional properties for flexibility
}