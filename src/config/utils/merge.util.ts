import mergeWith from 'lodash.mergewith';

/**
 * Custom merge customizer that replaces arrays instead of merging them by index
 *
 * @description
 * By default, lodash.merge merges arrays by index position, which can lead to
 * unexpected behavior when merging configuration from multiple sources:
 *
 * Default behavior (undesired):
 *   merge({a: [1,2,3]}, {a: [4,5]}) => {a: [4,5,3]}  ❌
 *
 * With this customizer:
 *   mergeWith({a: [1,2,3]}, {a: [4,5]}, arrayReplacementCustomizer) => {a: [4,5]}  ✅
 *
 * This ensures that when configuration is layered (YAML files, env vars, AWS secrets),
 * arrays are completely replaced by the last source rather than merged by index.
 *
 * @param objValue - The destination value being merged into
 * @param srcValue - The source value being merged from
 * @returns The source value if it's an array (for complete replacement), or undefined to let mergeWith handle other types
 *
 * @example
 * import mergeWith from 'lodash.mergewith';
 * import { arrayReplacementCustomizer } from '@/config/utils/merge.util';
 *
 * // Merge configuration with array replacement
 * const result = mergeWith(
 *   {},
 *   yamlConfig,
 *   envConfig,
 *   arrayReplacementCustomizer
 * );
 *
 * @example
 * // Real-world configuration scenario
 * const baseConfig = {
 *   evm: {
 *     networks: [
 *       { chainId: 1, name: 'Ethereum' },
 *       { chainId: 10, name: 'Optimism' }
 *     ]
 *   }
 * };
 *
 * const overrideConfig = {
 *   evm: {
 *     networks: [
 *       { chainId: 137, name: 'Polygon' }
 *     ]
 *   }
 * };
 *
 * const merged = mergeWith({}, baseConfig, overrideConfig, arrayReplacementCustomizer);
 * // Result: { evm: { networks: [{ chainId: 137, name: 'Polygon' }] } }
 * // NOT: { evm: { networks: [{ chainId: 137, name: 'Polygon' }, { chainId: 10, name: 'Optimism' }] } }
 */
export function arrayReplacementCustomizer<T = any>(objValue: T, srcValue: T): T | undefined {
  if (Array.isArray(srcValue)) {
    return srcValue;
  }
  return undefined;
}

/**
 * Helper function that wraps mergeWith with arrayReplacementCustomizer
 *
 * @description
 * Convenience function for merging multiple configuration sources with array replacement.
 * All sources are merged left-to-right, with later sources taking precedence.
 * Arrays are completely replaced (not merged by index), while objects are deeply merged.
 *
 * @param sources - Configuration objects to merge (1 or more)
 * @returns Merged configuration with arrays replaced and objects deeply merged
 *
 * @example
 * import { mergeWithArrayReplacement } from '@/config/utils/merge.util';
 *
 * const merged = mergeWithArrayReplacement(
 *   defaultConfig,
 *   yamlConfig,
 *   envConfig,
 *   awsSecrets
 * );
 *
 * @example
 * // Merge order matters - last source wins for arrays
 * const result = mergeWithArrayReplacement(
 *   { items: [1, 2, 3], nested: { value: 'a' } },
 *   { items: [4, 5], nested: { extra: 'b' } }
 * );
 * // Result: { items: [4, 5], nested: { value: 'a', extra: 'b' } }
 */
export function mergeWithArrayReplacement<T extends Record<string, any>>(
  ...sources: Partial<T>[]
): T {
  return mergeWith({} as T, ...sources, arrayReplacementCustomizer) as T;
}
