import { BaseStructuredLogger } from '../loggers/base-structured-logger'
import { DatadogLogStructure } from '../types'

/**
 * Configuration options for LogOperation decorator
 */
export interface LogOperationOptions {
  /** Sampling configuration for cost optimization */
  sampling?: {
    rate: number // 0-1, where 0.1 = 10% sampling
    level?: 'debug' | 'info' | 'warn' | 'error'
  }

  /** Conditions under which to log */
  conditions?: ('development' | 'production' | 'test')[]

  /** Whether to include timing metrics */
  includeTiming?: boolean

  /** Whether to log method entry */
  logEntry?: boolean

  /** Whether to log method exit */
  logExit?: boolean

  /** Whether to log errors */
  logErrors?: boolean

  /** Custom operation ID generator */
  operationIdGenerator?: () => string
}

/**
 * Logger constructor type for dependency injection
 */
export type LoggerConstructor = new (name: string, options?: any) => BaseStructuredLogger

/**
 * Context extraction result from decorated parameters
 */
export interface ExtractedContext {
  eco?: Record<string, any>
  metrics?: Record<string, any>
  operation?: Record<string, any>
  performance?: Record<string, any>
  [key: string]: any
}

/**
 * Entity type guards for context extraction
 */
export interface EntityTypeGuards {
  isRebalance: (entity: any) => boolean
  isIntent: (entity: any) => boolean
  isQuote: (entity: any) => boolean
  isWallet: (entity: any) => boolean
  isTransaction: (entity: any) => boolean
  isRebalanceJobData: (entity: any) => boolean
  isRebalanceRequest: (entity: any) => boolean
  isIntentSourceModel: (entity: any) => boolean
  isTokenData: (entity: any) => boolean
  isValidationChecks: (entity: any) => boolean
  isGaslessIntentRequest: (entity: any) => boolean
  isPublicClient: (entity: any) => boolean
}

/**
 * Context extractor function signature
 */
export type ContextExtractor<T = any> = (entity: T) => Promise<ExtractedContext> | ExtractedContext

/**
 * Context extractor registry for different entity types
 */
export interface ContextExtractorRegistry {
  [entityType: string]: ContextExtractor
}

/**
 * Metadata keys for decorator reflection
 */
export const DECORATOR_METADATA_KEYS = {
  LOG_CONTEXT: 'decorator:log-context',
  LOG_OPERATION: 'decorator:log-operation',
  LOG_SUB_OPERATION: 'decorator:log-sub-operation',
} as const

/**
 * Operation tracking for nested operations
 */
export interface DecoratorOperationContext {
  operationId: string
  operationType: string
  parentOperationId?: string
  startTime: number
  level: number
  context: ExtractedContext
}

/**
 * Global operation stack for nested operation tracking
 */
export interface OperationStack {
  current(): DecoratorOperationContext | null
  push(operation: DecoratorOperationContext): void
  pop(): DecoratorOperationContext | null
  clear(): void
}

/**
 * Enhanced context with operational metadata
 */
export interface EnhancedLogContext extends DatadogLogStructure {
  operation?: {
    id: string
    type: string
    parent_id?: string
    level: number
    method_name: string
  }
}

/**
 * Configuration for context enhancement decorator
 */
export interface ContextEnhancementOptions {
  async?: boolean
  priority?: number // Lower numbers get executed first
}

/**
 * Context enhancement function signature
 */
export type ContextEnhancer<T = any> = (
  entity: T,
  currentContext: ExtractedContext,
) => Promise<Partial<ExtractedContext>> | Partial<ExtractedContext>
