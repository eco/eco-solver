// Main decorator exports
export {
  LogOperation,
  LogSubOperation,
  EnhanceContext,
  getCurrentOperationContext,
  clearOperationStack,
} from './log-operation.decorator'
export {
  LogContext,
  getContextParameterIndices,
  getContextParameterTypes,
} from './log-context.decorator'

// Context extraction utilities
export {
  extractContextFromEntity,
  extractRebalanceContext,
  extractRebalanceJobDataContext,
  extractRebalanceRequestContext,
  extractIntentContext,
  extractQuoteContext,
  extractWalletContext,
  extractTransactionContext,
  extractQuoteRejectionContext,
  mergeContexts,
  entityTypeGuards,
} from './context-extractors'

// Types and interfaces
export type {
  LogOperationOptions,
  LoggerConstructor,
  ExtractedContext,
  EntityTypeGuards,
  ContextExtractor,
  ContextExtractorRegistry,
  DecoratorOperationContext,
  OperationStack,
  EnhancedLogContext,
  ContextEnhancementOptions,
  ContextEnhancer,
} from './types'

export { DECORATOR_METADATA_KEYS } from './types'
