import { Injectable, Logger } from '@nestjs/common';

import { RhinestonePayload } from '@/modules/queue/interfaces/execution-job.interface';
import { RedisService } from '@/modules/redis/redis.service';

/**
 * Service for storing and retrieving Rhinestone-specific execution data
 * Uses Redis for persistent, multi-instance safe storage with automatic TTL cleanup
 */
@Injectable()
export class RhinestoneMetadataService {
  private readonly logger = new Logger(RhinestoneMetadataService.name);
  private readonly TTL = 3600; // 1 hour TTL - plenty of time for execution

  constructor(private readonly redisService: RedisService) {}

  /**
   * Store Rhinestone payload for an intent
   * Data expires automatically after 1 hour
   */
  async set(intentHash: string, payload: RhinestonePayload): Promise<void> {
    const key = this.getKey(intentHash);

    // Serialize bigints to strings for JSON storage
    const value = JSON.stringify({
      claimTo: payload.claimTo,
      claimData: payload.claimData,
      claimValue: payload.claimValue.toString(),
      fillTo: payload.fillTo,
      fillData: payload.fillData,
      fillValue: payload.fillValue.toString(),
    });

    const client = this.redisService.getClient();
    await client.setex(key, this.TTL, value);

    this.logger.debug(`Stored Rhinestone payload for intent: ${intentHash}`);
  }

  /**
   * Retrieve Rhinestone payload for an intent
   * Returns null if not found or expired
   */
  async get(intentHash: string): Promise<RhinestonePayload | null> {
    const key = this.getKey(intentHash);
    const client = this.redisService.getClient();
    const value = await client.get(key);

    if (!value) {
      this.logger.warn(`No Rhinestone payload found for intent: ${intentHash}`);
      return null;
    }

    // Deserialize and convert string bigints back
    const parsed = JSON.parse(value);
    return {
      claimTo: parsed.claimTo,
      claimData: parsed.claimData,
      claimValue: BigInt(parsed.claimValue),
      fillTo: parsed.fillTo,
      fillData: parsed.fillData,
      fillValue: BigInt(parsed.fillValue),
    };
  }

  /**
   * Delete Rhinestone payload for an intent
   * Should be called after successful execution to free memory
   */
  async delete(intentHash: string): Promise<void> {
    const key = this.getKey(intentHash);
    const client = this.redisService.getClient();
    await client.del(key);

    this.logger.debug(`Deleted Rhinestone payload for intent: ${intentHash}`);
  }

  /**
   * Generate Redis key for intent
   */
  private getKey(intentHash: string): string {
    return `rhinestone:payload:${intentHash}`;
  }
}
