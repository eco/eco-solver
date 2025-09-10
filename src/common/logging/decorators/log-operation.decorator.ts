import 'reflect-metadata'
import { performance } from 'perf_hooks'
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
 * Helper logger that exposes structured logging for decorators
 */
class DecoratorLogger extends BaseStructuredLogger {
  constructor(context: string) {
    super(context)
  }

  // Expose the protected method as public for decorators
  public logMessage(structure: any, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    // Use the parent class methods based on level
    switch (level) {
      case 'debug':
        super.debug(structure)
        break
      case 'info':
        super.log(structure)
        break
      case 'warn':
        super.warn(structure)
        break
      case 'error':
        super.error(structure)
        break
    }
  }
}

/**
 * Global operation stack for nested operation tracking
 */
class OperationStackImpl {
  private stack: DecoratorOperationContext[] = []

  current(): DecoratorOperationContext | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null
  }

  push(operation: DecoratorOperationContext): void {
    this.stack.push(operation)
  }

  pop(): DecoratorOperationContext | null {
    return this.stack.pop() || null
  }

  clear(): void {
    this.stack = []
  }
}

const operationStack = new OperationStackImpl()

/**
 * Generate unique operation ID
 */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
 */
function shouldSample(options: LogOperationOptions, level: string): boolean {
  if (!options.sampling) return true

  const { rate, level: samplingLevel = 'debug' } = options.sampling

  // Only apply sampling to the specified level or lower priority levels
  if (level !== samplingLevel) return true

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
    // Convert to string and limit size for logging
    // Use custom replacer to handle BigInt values
    const stringified = JSON.stringify(
      result,
      (key, value) => {
        // Convert BigInt to string
        if (typeof value === 'bigint') {
          return value.toString()
        }
        return value
      },
      0,
    )

    // Handle case where stringified could be undefined or null
    if (!stringified || stringified.length <= 1000) {
      return result
    }

    return `${stringified.substring(0, 1000)}...[truncated]`
  } catch (error) {
    // If JSON.stringify fails, return a safe representation
    return `[Object: ${typeof result}]`
  }
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
      }

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
        },
      }

      // Push to operation stack
      operationStack.push(operationContext)

      try {
        // Entry logging
        if (options.logEntry !== false && shouldSample(options, 'info')) {
          const decoratorLogger = new DecoratorLogger(target.constructor.name)
          decoratorLogger.logMessage(
            {
              message: `${operationType} started`,
              ...enhancedContext,
            },
            'info',
          )
        }

        // Execute original method
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - startTime

        // Success logging
        if (options.logExit !== false && shouldSample(options, 'info')) {
          const successContext = {
            ...enhancedContext,
            performance: {
              ...enhancedContext.performance,
              duration_ms: Math.round(duration * 100) / 100,
            },
          }

          const decoratorLogger = new DecoratorLogger(target.constructor.name)
          decoratorLogger.logMessage(
            {
              message: `${operationType} completed successfully`,
              ...successContext,
              result: sanitizeResult(result),
            },
            'info',
          )
        }

        return result
      } catch (error) {
        const duration = performance.now() - startTime

        // Error logging
        if (options.logErrors !== false) {
          const errorContext = {
            ...enhancedContext,
            performance: {
              ...enhancedContext.performance,
              duration_ms: Math.round(duration * 100) / 100,
            },
            error: {
              type: error instanceof Error ? error.constructor.name : 'UnknownError',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          }

          const decoratorLogger = new DecoratorLogger(target.constructor.name)
          decoratorLogger.logMessage(
            {
              message: `${operationType} failed`,
              ...errorContext,
            },
            'error',
          )
        }

        throw error
      } finally {
        // Pop from operation stack
        operationStack.pop()
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

        // Use DecoratorLogger for sub-operations
        const logger = new DecoratorLogger(target.constructor.name)

        const operationId = generateOperationId()
        const startTime = performance.now()

        // Inherit parent context
        const enhancedContext = {
          ...parentOperation.context,
          operation: {
            ...parentOperation.context.operation,
            id: operationId,
            type: subOperationType,
            parent_id: parentOperation.operationId,
            level: parentOperation.level + 1,
            method_name: String(propertyName),
          },
        }

        try {
          // Entry logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logger.logMessage(
              {
                message: `${subOperationType} started`,
                ...enhancedContext,
              },
              'debug',
            )
          }

          const result = await originalMethod.apply(this, args)
          const duration = performance.now() - startTime

          // Success logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logger.logMessage(
              {
                message: `${subOperationType} completed`,
                ...enhancedContext,
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
            )
          }

          return result
        } catch (error) {
          const duration = performance.now() - startTime

          // Error logging for sub-operation
          logger.logMessage(
            {
              message: `${subOperationType} failed`,
              ...enhancedContext,
              performance: {
                ...enhancedContext.performance,
                duration_ms: Math.round(duration * 100) / 100,
              },
              error: {
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
              },
            },
            'error',
          )

          throw error
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

        // Use DecoratorLogger for sub-operations
        const logger = new DecoratorLogger(target.constructor.name)

        const operationId = generateOperationId()
        const startTime = performance.now()

        // Inherit parent context
        const enhancedContext = {
          ...parentOperation.context,
          operation: {
            ...parentOperation.context.operation,
            id: operationId,
            type: subOperationType,
            parent_id: parentOperation.operationId,
            level: parentOperation.level + 1,
            method_name: String(propertyName),
          },
        }

        try {
          // Entry logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logger.logMessage(
              {
                message: `${subOperationType} started`,
                ...enhancedContext,
              },
              'debug',
            )
          }

          const result = originalMethod.apply(this, args)
          const duration = performance.now() - startTime

          // Success logging for sub-operation
          if (shouldSample(options, 'debug')) {
            logger.logMessage(
              {
                message: `${subOperationType} completed`,
                ...enhancedContext,
                performance: {
                  ...enhancedContext.performance,
                  duration_ms: Math.round(duration * 100) / 100,
                },
              },
              'debug',
            )
          }

          return result
        } catch (error) {
          const duration = performance.now() - startTime

          // Error logging for sub-operation
          logger.logMessage(
            {
              message: `${subOperationType} failed`,
              ...enhancedContext,
              performance: {
                ...enhancedContext.performance,
                duration_ms: Math.round(duration * 100) / 100,
              },
              error: {
                type: error instanceof Error ? error.constructor.name : 'UnknownError',
                message: error instanceof Error ? error.message : String(error),
              },
            },
            'error',
          )

          throw error
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
