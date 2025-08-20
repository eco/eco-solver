import { Logger } from '@nestjs/common'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'

export interface RetryConfig {
  maxRetries: number
  retryDelay: number
  backoffMultiplier?: number
  shouldRetry?: (error: any) => boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors, timeouts, and temporary failures
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'rate limit',
      'too many requests',
    ]
    const errorMessage = error?.message?.toLowerCase() || ''
    return retryableErrors.some((e) => errorMessage.includes(e.toLowerCase()))
  },
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: Logger,
  context?: Record<string, any>,
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: any

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === finalConfig.maxRetries || !finalConfig.shouldRetry!(error)) {
        throw error
      }

      const delay = finalConfig.retryDelay * Math.pow(finalConfig.backoffMultiplier || 1, attempt)

      if (logger) {
        logger.debug(
          EcoLogMessage.withId({
            message: `Retrying operation after error. Attempt ${attempt + 1}/${
              finalConfig.maxRetries
            }`,
            properties: {
              error: error.message,
              delay,
              ...context,
            },
          }),
        )
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out',
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}
