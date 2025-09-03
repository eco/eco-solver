import 'reflect-metadata'
import { DECORATOR_METADATA_KEYS } from './types'

/**
 * Parameter decorator to mark entities for automatic context extraction
 *
 * Usage:
 * ```typescript
 * @LogOperation('rebalance_execution', LiquidityManagerLogger)
 * async executeRebalance(@LogContext rebalance: Rebalance): Promise<void> {
 *   // Context automatically extracted from rebalance parameter
 * }
 * ```
 */
export function LogContext(
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
