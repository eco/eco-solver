import { Injectable } from '@nestjs/common'
// Import built-in NestJS cache decorators instead of custom ones
export { CacheKey, CacheTTL } from '@nestjs/cache-manager'

// Simple in-memory cache for non-sensitive config data only
@Injectable()
export class ConfigurationCacheService {
  private readonly memoryCache = new Map<string, { value: any; expires: number }>()

  get<T>(key: string): T | undefined {
    const cached = this.memoryCache.get(key)
    if (cached && Date.now() < cached.expires) {
      return cached.value
    }
    if (cached) {
      this.memoryCache.delete(key) // Clean up expired
    }
    return undefined
  }

  set<T>(key: string, value: T, ttlMs: number = 300000): void {
    // Never cache sensitive data - only non-sensitive config
    if (this.isSensitiveKey(key)) {
      throw new Error(`Cannot cache sensitive data: ${key}`)
    }

    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    })
  }

  invalidate(pattern: string): void {
    const keysToDelete = Array.from(this.memoryCache.keys()).filter((key) => key.includes(pattern))

    keysToDelete.forEach((key) => this.memoryCache.delete(key))
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      'secret',
      'password',
      'token',
      'key',
      'credential',
      'aws',
      'database',
      'redis',
      'auth',
      'jwt',
    ]
    return sensitivePatterns.some((pattern) => key.toLowerCase().includes(pattern))
  }

  // Clear all cache on shutdown
  onModuleDestroy() {
    this.memoryCache.clear()
  }
}