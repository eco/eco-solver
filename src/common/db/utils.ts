import { Document } from 'mongoose'

/**
 * Utility type for creating repository input parameters from database models
 * Excludes all Document fields and common auto-generated fields
 */
export type CreateModelParams<T> = Omit<T, keyof Document | '_id' | 'createdAt' | 'updatedAt'>

/**
 * Utility type for creating repository input parameters with additional excluded fields
 * Useful when you need to exclude specific fields beyond the standard ones
 */
export type CreateModelParamsWithExclusions<T, K extends keyof T = never> = Omit<
  T,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | K
>

/**
 * Utility type for update operations that allows partial updates
 * Excludes immutable fields but allows updating all other fields
 */
export type UpdateModelParams<T> = Partial<Omit<T, keyof Document | '_id' | 'createdAt'>>
