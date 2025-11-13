export interface ConfigEntry {
  path: string[];
  value: any;
}

export class ConfigTraverser {
  /**
   * Recursively traverses configuration object and extracts all leaf values with their paths.
   * Arrays are flattened into indexed paths (e.g., ['evm', 'networks', '0', 'chainId'])
   */
  public traverse(obj: any, currentPath: string[] = [], result: ConfigEntry[] = []): ConfigEntry[] {
    // Skip null/undefined
    if (obj === null || obj === undefined) {
      return result;
    }

    // Handle arrays - create indexed paths
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.traverse(item, [...currentPath, String(index)], result);
      });
      return result;
    }

    // Handle objects - recurse into properties
    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        this.traverse(value, [...currentPath, key], result);
      }
      return result;
    }

    // Leaf value - add to results
    result.push({ path: currentPath, value: obj });
    return result;
  }
}
