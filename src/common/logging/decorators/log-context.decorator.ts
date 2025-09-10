import 'reflect-metadata'
import { DECORATOR_METADATA_KEYS } from './types'

/**
 * Parameter decorator to mark entities for automatic context extraction
 *
 * Usage:
 * ```typescript
 * @LogOperation('rebalance_execution', LiquidityManagerLogger)
 * async executeRebalance(@LogContext rebalance: Rebalance, @LogContext('custom_key') interval: number): Promise<void> {
 *   // Context automatically extracted from rebalance parameter and interval with custom key
 * }
 * ```
 */
export function LogContext(
  keyNameOrTarget?: string | any,
  propertyName?: string | symbol,
  parameterIndex?: number,
): any {
  // Handle direct usage: @LogContext (without parentheses)
  if (typeof keyNameOrTarget !== 'string' && keyNameOrTarget !== undefined) {
    const target = keyNameOrTarget
    return logContextDecorator(undefined, target, propertyName!, parameterIndex!)
  }

  // Handle factory usage: @LogContext('customKey') (with parentheses)
  const keyName = keyNameOrTarget as string
  return function (target: any, propertyName: string | symbol, parameterIndex: number): void {
    return logContextDecorator(keyName, target, propertyName, parameterIndex)
  }
}

/**
 * Internal decorator implementation
 */
function logContextDecorator(
  keyName: string | undefined,
  target: any,
  propertyName: string | symbol,
  parameterIndex: number,
): void {
  // Get existing context parameter indices for this method
  const existingIndices =
    Reflect.getMetadata(DECORATOR_METADATA_KEYS.LOG_CONTEXT, target, propertyName) || []

  // Add this parameter index to the list
  existingIndices.push(parameterIndex)

  // Store updated indices
  Reflect.defineMetadata(DECORATOR_METADATA_KEYS.LOG_CONTEXT, existingIndices, target, propertyName)

  // Store custom key names for parameters
  if (keyName) {
    const customKeys =
      Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:keys`, target, propertyName) || {}
    customKeys[parameterIndex] = keyName
    Reflect.defineMetadata(
      `${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:keys`,
      customKeys,
      target,
      propertyName,
    )
  }

  // Store parameter names if we can extract them
  const parameterNames = extractParameterNames(target, propertyName)
  if (parameterNames.length > parameterIndex) {
    const storedParamNames =
      Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:names`, target, propertyName) ||
      {}
    storedParamNames[parameterIndex] = parameterNames[parameterIndex]
    Reflect.defineMetadata(
      `${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:names`,
      storedParamNames,
      target,
      propertyName,
    )
  }

  // Also store parameter type information if available
  const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyName) || []
  if (paramTypes[parameterIndex]) {
    const contextParamTypes =
      Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:types`, target, propertyName) ||
      []

    contextParamTypes[parameterIndex] = paramTypes[parameterIndex]

    Reflect.defineMetadata(
      `${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:types`,
      contextParamTypes,
      target,
      propertyName,
    )
  }
}

/**
 * Extract parameter names from function signature
 */
function extractParameterNames(target: any, propertyName: string | symbol): string[] {
  const method = target[propertyName]
  if (typeof method !== 'function') return []

  const functionString = method.toString()
  const match = functionString.match(/\(([^)]*)\)/)
  if (!match || !match[1]) return []

  return match[1]
    .split(',')
    .map((param) => param.trim().split(/\s+/)[0].split(':')[0])
    .filter((name) => name && name !== '')
}

/**
 * Utility function to get all context parameter indices for a method
 */
export function getContextParameterIndices(target: any, propertyName: string | symbol): number[] {
  return Reflect.getMetadata(DECORATOR_METADATA_KEYS.LOG_CONTEXT, target, propertyName) || []
}

/**
 * Utility function to get context parameter types for a method
 */
export function getContextParameterTypes(target: any, propertyName: string | symbol): any[] {
  return (
    Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:types`, target, propertyName) || []
  )
}

/**
 * Utility function to get custom key names for context parameters
 */
export function getContextParameterKeys(
  target: any,
  propertyName: string | symbol,
): { [index: number]: string } {
  return (
    Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:keys`, target, propertyName) || {}
  )
}

/**
 * Utility function to get parameter names for context parameters
 */
export function getContextParameterNames(
  target: any,
  propertyName: string | symbol,
): { [index: number]: string } {
  return (
    Reflect.getMetadata(`${DECORATOR_METADATA_KEYS.LOG_CONTEXT}:names`, target, propertyName) || {}
  )
}
