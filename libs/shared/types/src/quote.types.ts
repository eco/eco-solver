/**
 * Quote-related types shared across libraries
 */

/**
 * Quote execution type based on intent execution types
 */
export type QuoteExecutionType = 'SELF_PUBLISH' | 'GASLESS'

/**
 * Configuration for quotes module
 */
export type QuotesConfig = {
  intentExecutionTypes: QuoteExecutionType[]
}

/**
 * Basic interface for quote data entry (simplified for libs usage)
 */
export interface BaseQuoteDataEntry {
  executionType: string
  estimatedGas: string
  quoteID: string
  [key: string]: any // Allow additional properties
}

/**
 * Parameters for updating quote
 */
export interface UpdateQuoteParams {
  quoteDataEntry?: BaseQuoteDataEntry
  error?: any
}