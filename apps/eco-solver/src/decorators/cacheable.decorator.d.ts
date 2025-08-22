/**
 * This decorator caches the result of a function for a specified time to live (ttl).
 * Needs the calling class to have a cacheManager and configService injected.
 *
 * @param opts - ttl: time to live in seconds, bypassArgIndex: index of the argument to bypass cache
 * @returns
 */
export declare function Cacheable(opts?: {
    ttl?: number;
    bypassArgIndex?: number;
}): (target: any, key: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
