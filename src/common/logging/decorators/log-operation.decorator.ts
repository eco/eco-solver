import 'reflect-metadata'
import { performance } from 'perf_hooks'
import { AsyncLocalStorage } from 'async_hooks'
import {
  LogOperationOptions,
  LoggerConstructor,
  DecoratorOperationContext,
  ExtractedContext,
} from './types'
import {
  getContextParameterIndices,
  getContextParameterKeys,
  getContextParameterNames,
} from './log-context.decorator'
import { extractContextFromEntity, mergeContexts } from './context-extractors'
import { BaseStructuredLogger } from '../loggers/base-structured-logger'

/**
 * Context-isolated operation stack for nested operation tracking
 * Uses AsyncLocalStorage to ensure each async execution context has its own operation stack
 */
class AsyncOperationStack {
  private asyncStorage = new AsyncLocalStorage<DecoratorOperationContext[]>()

  /**
   * Get the current operation context for this async execution
   */
  current(): DecoratorOperationContext | null {
    const stack = this.asyncStorage.getStore() || []
    return stack.length > 0 ? stack[stack.length - 1] : null
  }

  /**
   * Push an operation context to the current async execution's stack
   */
  push(operation: DecoratorOperationContext): void {
    const stack = this.asyncStorage.getStore() || []
    stack.push(operation)
  }

  /**
   * Pop an operation context from the current async execution's stack
   */
  pop(): DecoratorOperationContext | null {
    const stack = this.asyncStorage.getStore() || []
    return stack.pop() || null
  }

  /**
   * Clear the current async execution's stack (mainly for testing)
   */
  clear(): void {
    const stack = this.asyncStorage.getStore()
    if (stack) {
      stack.length = 0
    }
  }

  /**
   * Run a function within an isolated async context with its own operation stack
   */
  run<R>(callback: () => R): R {
    return this.asyncStorage.run([], callback)
  }

  /**
   * Get or create the stack for the current async context
   */
  private getOrCreateStack(): DecoratorOperationContext[] {
    let stack = this.asyncStorage.getStore()
    if (!stack) {
      // If no stack exists, create one for this execution context
      stack = []
      this.asyncStorage.enterWith(stack)
    }
    return stack
  }
}

const operationStack = new AsyncOperationStack()

/**
 * Generate unique operation ID
 */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Format log structure to conform to DatadogLogStructure interface
 */
function formatForDatadog(structure: any, level: string, context: string): any {
  return {
    '@timestamp': new Date().toISOString(),
    message: structure.message || 'Operation log',
    service: context,
    status: level,
    ddsource: 'nodejs',
    ddtags: `env:${process.env.NODE_ENV || 'development'},service:${context}`,
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    'logger.name': context,
    ...structure,
  }
}

/**
 * Helper to log with proper Datadog formatting
 */
function logWithFormatting(
  logger: BaseStructuredLogger,
  structure: any,
  level: 'debug' | 'info' | 'warn' | 'error',
  context: string,
): void {
  const formatted = formatForDatadog(structure, level, context)
  logger.logStructured(formatted, level)
}

/**
 * Check if logging should occur based on conditions
 */
function shouldLog(options: LogOperationOptions): boolean {
  if (!options.conditions) return true

  const env = process.env.NODE_ENV || 'development'
  return options.conditions.includes(env as any)
}

/**
 * Check if sampling allows this log
 * Applies sampling to the specified level and all lower priority levels
 */
function shouldSample(options: LogOperationOptions, level: string): boolean {
  if (!options.sampling) return true

  const { rate, level: samplingLevel = 'debug' } = options.sampling

  // Define level hierarchy (lower index = lower priority)
  const levels = ['debug', 'info', 'warn', 'error']
  const currentLevelIndex = levels.indexOf(level)
  const samplingLevelIndex = levels.indexOf(samplingLevel)

  // Handle invalid levels gracefully
  if (currentLevelIndex === -1 || samplingLevelIndex === -1) {
    return true // Don't sample unknown levels
  }

  // Only apply sampling to the specified level or lower priority levels
  if (currentLevelIndex > samplingLevelIndex) {
    return true // Skip sampling for higher priority levels
  }

  // Apply sampling to current level and lower priority levels
  return Math.random() < rate
}

/**
 * Extract context from method arguments using @LogContext decorated parameters
 */
async function extractContextFromArgs(
  args: any[],
  target: any,
  propertyName: string | symbol,
): Promise<ExtractedContext> {
  const contextIndices = getContextParameterIndices(target, propertyName)

  if (contextIndices.length === 0) {
    return {}
  }

  const customKeys = getContextParameterKeys(target, propertyName)
  const parameterNames = getContextParameterNames(target, propertyName)
  const contexts: ExtractedContext[] = []

  for (const index of contextIndices) {
    if (index < args.length) {
      const entity = args[index]
      // Use custom key if provided, otherwise use parameter name, otherwise use default
      const keyName = customKeys[index] || parameterNames[index]
      const extractedContext = await extractContextFromEntity(entity, keyName)
      contexts.push(extractedContext)
    }
  }

  return mergeContexts(...contexts)
}

/**
 * Sanitize result for logging (remove sensitive data, limit size)
 */
function sanitizeResult(result: any): any {
  if (!result) return result

  try {
    // Deep clone and sanitize the result
    const sanitized = sanitizeObjectForLogging(result)

    // Convert to string and limit size for logging
    const stringified = JSON.stringify(sanitized, null, 0)

    // Handle case where stringified could be undefined or null
    if (!stringified || stringified.length <= 1000) {
      return sanitized
    }

    return `${stringified.substring(0, 1000)}...[truncated]`
  } catch (error) {
    // If JSON.stringify fails, return a safe representation
    return `[Object: ${typeof result}]`
  }
}

/**
 * Recursively sanitize objects for logging, handling BigInt and other special types
 */
function sanitizeObjectForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectForLogging(item))
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    // Skip functions and other non-serializable types
    if (typeof value === 'function' || typeof value === 'symbol') continue

    sanitized[key] = sanitizeObjectForLogging(value)
  }

  return sanitized
}

/**
 * Check if an error is potentially recoverable
 */
function isRecoverableError(error: any): boolean {
  if (!error) return false

  const recoverablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /rate limit/i,
    /throttle/i,
    /temporary/i,
    /unavailable/i,
  ]

  const errorMessage = error.message || error.toString()
  return recoverablePatterns.some((pattern) => pattern.test(errorMessage))
}

/**
 * Primary decorator for automatic operation logging
 *
 * @param operationType - Business operation name for logs
 * @param loggerClass - Specialized logger class (LiquidityManagerLogger, IntentOperationLogger, etc.)
 * @param options - Configuration for sampling, timing, etc.
 */
export function LogOperation(
  operationType: string,
  loggerClass: LoggerConstructor,
  options: LogOperationOptions = {},
) {
  return function (target: any, propertyName: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error('@LogOperation can only be applied to methods')
    }

    descriptor.value = async function (this: any, ...args: any[]) {
      // Check if logging should occur
      if (!shouldLog(options)) {
        return await originalMethod.apply(this, args)
      }

      // Extract context from decorated parameters
      const extractedContext = await extractContextFromArgs(args, target, propertyName)

      // Generate operation tracking info
      const operationId = options.operationIdGenerator
        ? options.operationIdGenerator()
        : generateOperationId()

      const parentOperation = operationStack.current()
      const startTime = performance.now()

      // Create operation context
      const operationContext: DecoratorOperationContext = {
        operationId,
        operationType,
        parentOperationId: parentOperation?.operationId,
        startTime,
        level: parentOperation ? parentOperation.level + 1 : 0,
        context: extractedContext,
        loggerClass,
      }

      // Define the operation execution logic
      const executeOperation = async () => {
        // Enhanced context with operation metadata
        const enhancedContext = {
          ...extractedContext,
          operation: {
            ...extractedContext.operation,
            id: operationId,
            type: operationType,
            parent_id: parentOperation?.operationId,
            level: operationContext.level,
            method_name: String(propertyName),
            status: 'started',
            correlation_id: operationId,
          },
        }

        // Push to operation stack
        operationStack.push(operationContext)

        try {
          // Entry logging
          if (options.logEntry !== false && shouldSample(options, 'info')) {
            const decoratorLogger = new loggerClass(target.constructor.name)
            logWithFormatting(
              decoratorLogger,
              {
                message: `${operationType} started`,
                ...enhancedContext,
              },
              'info',
              target.constructor.name,
            )
          }

          // Execute original method
          const result = await originalMethod.apply(this, args)
          const duration = performance.now() - startTime

          // Success logging
          if (options.logExit !== false && shouldSample(options, 'info')) {
            const successContext = {
              ...enhancedContext,
              operation: {
                ...enhancedContext.operation,
                status: 'completed',
                duration_ms: Math.round(duration * 100) / 100,
              },
              performance: {
                ...enhancedContext.performance,
                duration_ms: Math.round(duration * 100) / 100,
                response_time_ms: Math.round(duration * 100) / 100,
              },
            }

            const decoratorLogger = new loggerClass(target.constructor.name)
            logWithFormatting(
              decoratorLogger,
              {
                message: `${operationType} completed successfully`,
                ...successContext,
                result: sanitizeResult(result),
              },
              'info',
              target.constructor.name,
            )
          }

          return result
        } catch (error) {
          const duration = performance.now() - startTime

          // Check if this is a DelayedError from BullMQ - this is expected behavior, not a failure
          const isDelayedError = error instanceof Error && error.constructor.name === 'DelayedError'

          // Error logging (skip logging DelayedError as it's expected BullMQ behavior)
          if (options.logErrors !== false && !isDelayedError) {
            const errorContext = {
              ...enhancedContext,
              operation: {
                ...enhancedContext.operation,
                status: 'failed',
                duration_ms: Math.round(duration * 100) / 100,
              },
              performance: {
                ...enhancedContext.performance,
                duration_ms: Math.round(duration * 100) / 100,
                response_time_ms: Math.round(duration * 100) / 100,
              },
              error: {
                kind: error instanceof Error ? error.constructor.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                recoverable: isRecoverableError(error),
              },
            }

            const decoratorLogger = new loggerClass(target.constructor.name)
            logWithFormatting(
              decoratorLogger,
              {
                message: `${operationType} failed`,
                ...errorContext,
              },
              'error',
              target.constructor.name,
            )
          } else if (isDelayedError) {
            // Log DelayedError as debug information, not as an error
            const delayContext = {
              ...enhancedContext,
              operation: {
                ...enhancedContext.operation,
                status: 'delayed',
                duration_ms: Math.round(duration * 100) / 100,
              },
              performance: {
                ...enhancedContext.performance,
                duration_ms: Math.round(duration * 100) / 100,
                response_time_ms: Math.round(duration * 100) / 100,
              },
            }

            const decoratorLogger = new loggerClass(target.constructor.name)
            logWithFormatting(
              decoratorLogger,
              {
                message: `${operationType} delayed`,
                ...delayContext,
              },
              'debug',
              target.constructor.name,
            )
          }

          throw error
        } finally {
          // Pop from operation stack
          operationStack.pop()
        }
      }

      // If this is a root operation (no parent), run in isolated async context
      // This ensures concurrent operations don't interfere with each other
      if (!parentOperation) {
        return operationStack.run(executeOperation)
      } else {
        // For nested operations, execute within existing context
        return executeOperation()
      }
    }

    return descriptor
  }
}

/**
 * Sub-operation decorator for nested operation tracking
 * Inherits context from parent operation automatically
 */
export function LogSubOperation(subOperationType: string, options: LogOperationOptions = {}) {
  return function (target: any, propertyName: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error('@LogSubOperation can only be applied to methods')
    }

    // Detect if the original method is async by calling it with empty args and checking result
    const isAsync = (function (method: (...args: any[]) => any): boolean {
      // Check if it's declared as async function
      if (method.constructor.name === 'AsyncFunction') {
        return true
      }
      return false
    })(originalMethod)

    if (isAsync) {
      // Handle async methods
      descriptor.value = async function (this: any, ...args: any[]) {
        const parentOperation = operationStack.current()

        // If no parent operation, just execute normally
        if (!parentOperation) {
          return await originalMethod.apply(this, args)
        }

        // Check if logging should occur
        if (!shouldLog(options)) {
          return await originalMethod.apply(this, args)
        }

        // Use the same logger class as the parent operation
        const logger = new parentOperation.loggerClass(target.constructor.name)

        const operationId = generateOperationId()
        const startTime = performance.now()

        // Create sub-operation context
        const subOperationContext: DecoratorOperationContext = {
          operationId,
          operationType: subOperationType,
          parentOperationId: parentOperation.operationId,
          startTime,
          level: parentOperation.level + 1,
          context: parentOperation.context,
          loggerClass: parentOperation.loggerClass,
        }

        // Inherit parent context with sub-operation details
        const enhancedContext = {
          ...parentOperation.context,
          operation: {
            ...parentOperation.context.operation,
            id: operationId,
            type: subOperationType,
            parent_id: parentOperation.operationId,
            level: parentOperation.level + 1,
            method_name: String(propertyName),
            status: 'started',
            correlation_id:
              parentOperation.context.operation?.correlation_id || parentOperation.operationId,
          },
        }

        // Push sub-operation to stack for proper hierarchy
        operationStack.push(subOperationContext)

        try {
          // Entry logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} started`,
                ...enhancedContext,
              },
              'debug',
              target.constructor.name,
            )
          }

          const result = await originalMethod.apply(this, args)
          const duration = performance.now() - startTime

          // Success logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} completed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'completed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
              target.constructor.name,
            )
          }

          return result
        } catch (error) {
          const duration = performance.now() - startTime

          // Check if this is a DelayedError from BullMQ - this is expected behavior, not a failure
          const isDelayedError = error instanceof Error && error.constructor.name === 'DelayedError'

          // Error logging for sub-operation (skip DelayedError)
          if (!isDelayedError) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} failed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'failed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
                error: {
                  kind: error instanceof Error ? error.constructor.name : 'UnknownError',
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                  recoverable: isRecoverableError(error),
                },
              },
              'error',
              target.constructor.name,
            )
          } else {
            // Log DelayedError as debug information
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} delayed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'delayed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
              target.constructor.name,
            )
          }

          throw error
        } finally {
          // Pop sub-operation from stack
          operationStack.pop()
        }
      }
    } else {
      // Handle synchronous methods
      descriptor.value = function (this: any, ...args: any[]) {
        const parentOperation = operationStack.current()

        // If no parent operation, just execute normally
        if (!parentOperation) {
          return originalMethod.apply(this, args)
        }

        // Check if logging should occur
        if (!shouldLog(options)) {
          return originalMethod.apply(this, args)
        }

        // Use the same logger class as the parent operation
        const logger = new parentOperation.loggerClass(target.constructor.name)

        const operationId = generateOperationId()
        const startTime = performance.now()

        // Create sub-operation context
        const subOperationContext: DecoratorOperationContext = {
          operationId,
          operationType: subOperationType,
          parentOperationId: parentOperation.operationId,
          startTime,
          level: parentOperation.level + 1,
          context: parentOperation.context,
          loggerClass: parentOperation.loggerClass,
        }

        // Inherit parent context with sub-operation details
        const enhancedContext = {
          ...parentOperation.context,
          operation: {
            ...parentOperation.context.operation,
            id: operationId,
            type: subOperationType,
            parent_id: parentOperation.operationId,
            level: parentOperation.level + 1,
            method_name: String(propertyName),
            status: 'started',
            correlation_id:
              parentOperation.context.operation?.correlation_id || parentOperation.operationId,
          },
        }

        // Push sub-operation to stack for proper hierarchy
        operationStack.push(subOperationContext)

        try {
          // Entry logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} started`,
                ...enhancedContext,
              },
              'debug',
              target.constructor.name,
            )
          }

          const result = originalMethod.apply(this, args)
          const duration = performance.now() - startTime

          // Success logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} completed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'completed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
              target.constructor.name,
            )
          }

          return result
        } catch (error) {
          const duration = performance.now() - startTime

          // Check if this is a DelayedError from BullMQ - this is expected behavior, not a failure
          const isDelayedError = error instanceof Error && error.constructor.name === 'DelayedError'

          // Error logging for sub-operation (skip DelayedError)
          if (!isDelayedError) {
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} failed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'failed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
                error: {
                  kind: error instanceof Error ? error.constructor.name : 'UnknownError',
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                  recoverable: isRecoverableError(error),
                },
              },
              'error',
              target.constructor.name,
            )
          } else {
            // Log DelayedError as debug information
            logWithFormatting(
              logger,
              {
                message: `${subOperationType} delayed`,
                ...enhancedContext,
                operation: {
                  ...enhancedContext.operation,
                  status: 'delayed',
                  duration_ms: Math.round(duration * 100) / 100,
                },
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                  response_time_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
              target.constructor.name,
            )
          }

          throw error
        } finally {
          // Pop sub-operation from stack
          operationStack.pop()
        }
      }
    }

    return descriptor
  }
}

/**
 * Context enhancement decorator for adding custom context
 */
export function EnhanceContext<T = any>(
  enhancer: (
    entity: T,
    currentContext: ExtractedContext,
  ) => Promise<Partial<ExtractedContext>> | Partial<ExtractedContext>,
) {
  return function (target: any, propertyName: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error('@EnhanceContext can only be applied to methods')
    }

    // Store enhancer function in metadata for use by LogOperation
    const existingEnhancers = Reflect.getMetadata('context-enhancers', target, propertyName) || []
    existingEnhancers.push(enhancer)
    Reflect.defineMetadata('context-enhancers', existingEnhancers, target, propertyName)

    return descriptor
  }
}

/**
 * Utility to get current operation context (for manual logging within decorated methods)
 */
export function getCurrentOperationContext(): DecoratorOperationContext | null {
  return operationStack.current()
}

/**
 * Utility to clear operation stack (mainly for testing)
 */
export function clearOperationStack(): void {
  operationStack.clear()
}
