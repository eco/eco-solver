/**
 * Helper function to mask sensitive data in log properties
 * @param data - The data object to mask
 * @param keywords - Array of keywords to mask
 * @returns Masked data object
 */
export function maskSensitiveData(data: any, keywords: string[]): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, keywords));
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const shouldMask = keywords.some((keyword) => lowerKey.includes(keyword.toLowerCase()));

    if (shouldMask) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, keywords);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Creates a structured log message following Pino's format
 * First parameter is the message string, rest are merged into properties
 *
 * @example
 * logger.log(createLogMessage('User logged in', { userId: '123', ip: '1.2.3.4' }))
 * // Output: { msg: 'User logged in', userId: '123', ip: '1.2.3.4' }
 *
 * @example
 * logger.error(createLogMessage('Failed to process', { error: err, intentId: 'abc' }))
 * // Output: { msg: 'Failed to process', error: [Error object], intentId: 'abc' }
 */
export function createLogMessage(message: string, properties?: object): object {
  return {
    msg: message,
    ...properties,
  };
}

/**
 * Creates a structured log message with error
 * Automatically formats the error object
 */
export function createLogMessageWithError(
  message: string,
  error: Error,
  properties?: object,
): object {
  return createLogMessage(message, {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
    },
    ...properties,
  });
}
