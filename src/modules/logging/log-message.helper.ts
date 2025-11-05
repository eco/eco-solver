/**
 * Helper function to mask sensitive data in log properties
 * @param data - The data object to mask
 * @param keywords - Array of keywords to mask
 * @param visited - WeakSet to track visited objects and prevent circular references
 * @returns Masked data object
 */
export function maskSensitiveData(
  data: any,
  keywords: string[],
  visited: WeakSet<object> = new WeakSet(),
): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // Check for circular reference
  if (visited.has(data)) {
    return '[Circular]';
  }

  // Mark this object as visited
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, keywords, visited));
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const shouldMask = keywords.some((keyword) => lowerKey.includes(keyword.toLowerCase()));

    if (shouldMask) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, keywords, visited);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}
