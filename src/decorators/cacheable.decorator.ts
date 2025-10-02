import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Cache } from '@nestjs/cache-manager'
import { serializeWithBigInt, deserializeWithBigInt } from './utils'

/**
 * This decorator caches the result of a function for a specified time to live (ttl).
 * Needs the calling class to have a cacheManager and configService injected.
 *
 * @param opts - ttl: time to live in seconds, bypassArgIndex: index of the argument to bypass cache
 * @returns
 */
export function Cacheable(opts?: { ttl?: number; bypassArgIndex?: number }) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheManager: Cache = this.cacheManager // Injected service
      const configService: EcoConfigService = this.configService // Injected service
      if (opts && !opts.ttl) {
        opts.ttl = configService.getCache().ttl
      } else {
        opts = {
          ttl: configService.getCache().ttl,
        }
      }

      // Construct the cache key based on function arguments
      // Use serializeWithBigInt to handle any BigInt values in arguments
      const cacheKey = `${key}:${serializeWithBigInt(args)}`

      // Determine whether to bypass cache
      const forceRefresh = opts.bypassArgIndex ? args[opts.bypassArgIndex] === true : false

      if (!forceRefresh) {
        const cachedData = await cacheManager.get(cacheKey)
        if (cachedData && typeof cachedData === 'string') {
          return deserializeWithBigInt(cachedData)
        }
      }

      // Call the original method to fetch fresh data
      const result = await originalMethod.apply(this, args)
      await cacheManager.set(cacheKey, serializeWithBigInt(result), opts.ttl)
      return result
    }

    return descriptor
  }
}
