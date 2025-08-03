/**
 * Utility types used throughout the application
 */

/**
 * Recursively makes all properties in T optional
 * Useful for partial configurations and default values
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;