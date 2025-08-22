import Redlock, { Settings } from 'redlock';
import { Redis as IORedisClient, Cluster as IORedisCluster } from 'ioredis';
import { NestRedlockConfig } from './nest-redlock.config';
import { Lock } from 'redlock';
export type RedlockRedisClient = IORedisClient | IORedisCluster;
export declare class RedlockService extends Redlock {
    constructor(redlockConfig: NestRedlockConfig);
    /**
     * Executes the callback if the lock key is required, otherwise it throws an error
     * @param key the key to lock on
     * @param callback the callback to execute
     * @returns
     */
    lockCall(key: string, callback: () => Promise<any>): Promise<any>;
    /**
     * Non-throwing lock aquire that returns null if the lock is not available
     *
     * @param resources
     * @param duration time in ms
     * @param settings
     * @returns
     */
    acquireLock(resources: string[], duration: number, settings?: Partial<Settings>): Promise<Lock | null>;
}
