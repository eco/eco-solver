import { Injectable } from '@nestjs/common';

import { SystemLoggerService } from '@/modules/logging/logger.service';

import { RedisService } from './redis.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

/**
 * Generic Redis cache service for caching any type of data
 */
@Injectable()
export class RedisCacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(RedisCacheService.name);
  }

  /**
   * Get a value from cache
   * @param key The cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redisService.getClient().get(key);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Failed to get cache value for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Time to live in seconds
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisService.getClient().setex(key, ttl, serialized);
    } catch (error) {
      this.logger.warn(`Failed to set cache value for key ${key}: ${error}`);
    }
  }

  /**
   * Delete a value from cache
   * @param key The cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redisService.getClient().del(key);
    } catch (error) {
      this.logger.warn(`Failed to delete cache value for key ${key}: ${error}`);
    }
  }

  /**
   * Check if a key exists in cache
   * @param key The cache key
   * @returns true if the key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redisService.getClient().exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.warn(`Failed to check cache existence for key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key The cache key
   * @returns TTL in seconds, -1 if key doesn't exist, -2 if key has no TTL
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redisService.getClient().ttl(key);
    } catch (error) {
      this.logger.warn(`Failed to get TTL for key ${key}: ${error}`);
      return -1;
    }
  }

  /**
   * Create a namespaced cache with a specific prefix and default TTL
   * @param prefix The key prefix for this namespace
   * @param defaultTtl Default TTL in seconds
   * @returns A namespaced cache instance
   */
  createNamespace(prefix: string, defaultTtl?: number): NamespacedCache {
    return new NamespacedCache(this, prefix, defaultTtl);
  }
}

/**
 * A namespaced cache that automatically prefixes keys and applies default TTL
 */
export class NamespacedCache {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prefix: string,
    private readonly defaultTtl?: number,
  ) {}

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(this.getKey(key));
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.defaultTtl ?? 3600; // Default to 1 hour if no TTL specified
    return this.cache.set(this.getKey(key), value, effectiveTtl);
  }

  async delete(key: string): Promise<void> {
    return this.cache.delete(this.getKey(key));
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.exists(this.getKey(key));
  }

  async ttl(key: string): Promise<number> {
    return this.cache.ttl(this.getKey(key));
  }
}
