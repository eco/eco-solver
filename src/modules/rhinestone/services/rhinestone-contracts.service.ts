import { Injectable, Logger } from '@nestjs/common';

import { Address } from 'viem';

import { rhinestoneRouterAbi } from '@/common/abis/rhinestone-router.abi';
import { EvmTransportService } from '@/modules/blockchain/evm/services/evm-transport.service';

/**
 * Rhinestone contract interactions with 1-hour in-memory caching.
 */
@Injectable()
export class RhinestoneContractsService {
  private readonly logger = new Logger(RhinestoneContractsService.name);

  // In-memory cache for adapter lookups
  // Key format: `${chainId}:${type}:${router}:${selector}` for adapters
  private readonly adapterCache = new Map<string, Address>();

  // Cache TTL: 1 hour (in milliseconds)
  private readonly CACHE_TTL = 3600000;
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(private readonly transportService: EvmTransportService) {}

  /**
   * Get the adapter address for a given selector from the router contract.
   * Results are cached for 1 hour to reduce on-chain calls.
   *
   * @param chainId The chain ID where the router is deployed
   * @param router The router contract address
   * @param type Whether to get claim or fill adapter
   * @param selector The function selector to look up
   * @param version The version bytes (defaults to 0x0001)
   * @returns The adapter address
   */
  async getAdapter(
    chainId: number,
    router: Address,
    type: 'claim' | 'fill',
    selector: `0x${string}`,
    version: `0x${string}` = '0x0001',
  ): Promise<Address> {
    const cacheKey = `${chainId}:${type}:${router}:${selector}:${version}`;

    // Check cache
    const cached = this.getCachedValue(this.adapterCache, cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for adapter lookup: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for adapter lookup: ${cacheKey}, fetching from chain`);

    // Fetch from chain
    const publicClient = this.transportService.getPublicClient(chainId);
    const functionName = type === 'claim' ? 'getClaimAdapter' : 'getFillAdapter';

    // Contract returns [adapter: Address, adapterTag: Hex] - we only need the adapter
    const result = await publicClient.readContract({
      abi: rhinestoneRouterAbi,
      address: router,
      functionName,
      args: [version as `0x${string}`, selector],
    });

    // Destructure to get just the adapter address (first element of tuple)
    const [adapterAddress] = result as readonly [Address, `0x${string}`];

    // Store in cache
    this.setCachedValue(this.adapterCache, cacheKey, adapterAddress);

    return adapterAddress;
  }

  /**
   * Get cached value if it exists and is not expired
   */
  private getCachedValue(cache: Map<string, Address>, key: string): Address | undefined {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      return undefined;
    }

    const now = Date.now();
    if (now - timestamp > this.CACHE_TTL) {
      // Cache expired, remove it
      cache.delete(key);
      this.cacheTimestamps.delete(key);
      return undefined;
    }

    return cache.get(key);
  }

  /**
   * Store value in cache with timestamp
   */
  private setCachedValue(cache: Map<string, Address>, key: string, value: Address): void {
    cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clear all cached values (useful for testing)
   */
  clearCache(): void {
    this.adapterCache.clear();
    this.cacheTimestamps.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getCacheStats(): {
    adapterCacheSize: number;
  } {
    return {
      adapterCacheSize: this.adapterCache.size,
    };
  }
}
