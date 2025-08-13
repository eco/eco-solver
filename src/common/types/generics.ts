/**
 * Recursively replaces every `bigint` with `string` in `T`.
 */
export type BigIntsToStrings<T> =
  // 1. Turn bare `bigint` primitives into `string`
  [T] extends [bigint]
    ? string
    : // 2. Handle arrays & tuples – map element type and keep the same structure
      T extends readonly (infer U)[]
      ? readonly BigIntsToStrings<U>[]
      : // 3. Recurse through objects (including records, interfaces, classes)
        T extends object
        ? { [K in keyof T]: BigIntsToStrings<T[K]> }
        : // ^ retains optionality, readonly, etc.

          // 4. All other primitives and unknowns remain as-is
          T
