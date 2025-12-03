import { Injectable, Logger } from '@nestjs/common';

import { IntentDiscovery } from '@/common/enums/intent-discovery.enum';
import { IntentsService } from '@/modules/intents/intents.service';
import { RedisService } from '@/modules/redis/redis.service';

/**
 * Service for retrieving intent discovery methods with caching optimization
 * Abstracts cache vs DB lookup details from callers
 *
 * Discovery values indicate how we learned about an intent:
 * - 'blockchain-event': Detected by blockchain event listener
 * - 'rhinestone-websocket': Received via Rhinestone WebSocket
 */
@Injectable()
export class IntentDiscoveryService {
  private readonly logger = new Logger(IntentDiscoveryService.name);
  private readonly CACHE_PREFIX = 'intent:discovery:';
  private readonly CACHE_TTL = 3600; // 1 hour (in seconds)

  constructor(
    private readonly intentsService: IntentsService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get discovery method for an intent
   * Checks Redis cache first, falls back to database
   * Automatically populates cache on miss
   *
   * @param intentHash Intent hash to look up
   * @returns Discovery method (defaults to 'blockchain-event' if intent not found)
   */
  async getDiscovery(intentHash: string): Promise<string> {
    // Try cache first (fast path)
    const cached = await this.getCached(intentHash);
    if (cached) {
      this.logger.debug(`Discovery cache hit for ${intentHash}: ${cached}`);
      return cached;
    }

    // Cache miss - check database
    this.logger.debug(`Discovery cache miss for ${intentHash}, checking database`);
    const existingIntent = await this.intentsService.findById(intentHash);
    const discovery = existingIntent?.discovery || IntentDiscovery.BLOCKCHAIN_EVENT;

    // Populate cache for future lookups
    await this.setCached(intentHash, discovery);

    return discovery;
  }

  /**
   * Set discovery method in cache
   * Used by RhinestoneActionProcessor for proactive cache population
   *
   * @param intentHash Intent hash
   * @param discovery Discovery method to cache
   */
  async setDiscovery(intentHash: string, discovery: string): Promise<void> {
    await this.setCached(intentHash, discovery);
    this.logger.debug(`Proactively cached discovery for ${intentHash}: ${discovery}`);
  }

  /**
   * Get value from Redis cache
   * Returns null on cache miss or error (fail-safe)
   */
  private async getCached(intentHash: string): Promise<string | null> {
    try {
      const key = this.getCacheKey(intentHash);
      const client = this.redis.getClient();
      return await client.get(key);
    } catch (error) {
      // Log but don't throw - cache is optional optimization
      this.logger.warn(
        `Redis cache get failed for ${intentHash}, falling back to DB: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Set value in Redis cache
   * Silently fails on error (fail-safe)
   */
  private async setCached(intentHash: string, discovery: string): Promise<void> {
    try {
      const key = this.getCacheKey(intentHash);
      const client = this.redis.getClient();
      await client.set(key, discovery, 'EX', this.CACHE_TTL);
    } catch (error) {
      // Log but don't throw - cache is optional optimization
      this.logger.warn(
        `Redis cache set failed for ${intentHash}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clear all cached discovery values
   * Useful for testing or manual cache invalidation
   */
  async clearCache(): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}*`;
      const client = this.redis.getClient();
      const keys = await client.keys(pattern);

      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(`Cleared ${keys.length} discovery cache entries`);
      } else {
        this.logger.log('No discovery cache entries to clear');
      }
    } catch (error) {
      this.logger.error(
        `Failed to clear discovery cache: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getCacheKey(intentHash: string): string {
    return `${this.CACHE_PREFIX}${intentHash}`;
  }
}
