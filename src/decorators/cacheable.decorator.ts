import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { deserialize, serialize } from '@/common/utils/serialize'
import { Cache } from '@nestjs/cache-manager'

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
      const cacheKey = `${key}:${JSON.stringify(args)}` // Unique key for the cache

      // Determine whether to bypass cache
      const forceRefresh = opts.bypassArgIndex ? args[opts.bypassArgIndex] === true : false

      if (!forceRefresh) {
        const cachedData = await cacheManager.get(cacheKey)
        if (cachedData && typeof cachedData == 'string') {
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

function serializeWithBigInt(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint'
      ? { __type: 'BigInt', value: value.toString() }
      : value
  );
}

function deserializeWithBigInt(serialized: string): unknown {
  return JSON.parse(serialized, (_key, value) =>
    value && typeof value === 'object' && value.__type === 'BigInt'
      ? BigInt(value.value)
      : value
  );
}