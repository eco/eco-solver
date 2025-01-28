/**
 * The type of an array
 */
export type GetElementType<T> = T extends (infer U)[] ? U : never

/**
 * Removes the readonly modifier entire object
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

/**
 * Removes the readonly modifier from a field
 */
export type MutableField<T, K extends keyof T> = Omit<T, K> & {
  -readonly [P in K]: T[P]
}

/**
 * Removes nested fields from a type
 */
export type DeepOmit<T, K extends PropertyKey> = {
  [P in keyof T as P extends K ? never : P]: T[P] extends Array<infer U>
    ? Array<DeepOmit<U, K>> // Handle arrays: recursively apply `DeepOmit` to array elements
    : T[P] extends Record<string, any>
      ? DeepOmit<T[P], K> // Handle objects: recursively apply `DeepOmit`
      : T[P] // Keep other types as-is
}
