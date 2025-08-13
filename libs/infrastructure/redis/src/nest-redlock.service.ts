import { Inject, Injectable } from '@nestjs/common'
import Redlock, { Settings } from 'redlock'
import { Redis as IORedisClient, Cluster as IORedisCluster } from 'ioredis'
import { NestRedlockConfig, NEST_REDLOCK_CONFIG } from './nest-redlock.config'
import { RedisConnectionUtils } from '../common/redis/redis-connection-utils'
import { Lock } from 'redlock'

export type RedlockRedisClient = IORedisClient | IORedisCluster

@Injectable()
export class RedlockService extends Redlock {
  constructor(@Inject(NEST_REDLOCK_CONFIG) redlockConfig: NestRedlockConfig) {
    const { redlockSettings } = redlockConfig
    const redisClients = RedisConnectionUtils.getClientsForRedlock(redlockConfig)

    super(redisClients, redlockSettings)
  }

  /**
   * Executes the callback if the lock key is required, otherwise it throws an error
   * @param key the key to lock on
   * @param callback the callback to execute
   * @returns
   */
  async lockCall(key: string, callback: () => Promise<any>): Promise<any> {
    const lock = await this.acquireLock([key], 5000)
    if (!lock) {
      throw new Error('Could not acquire lock')
    }

    try {
      return await callback()
    } catch (e) {
      throw e
    } finally {
      await lock.release()
    }
  }

  /**
   * Non-throwing lock aquire that returns null if the lock is not available
   *
   * @param resources
   * @param duration time in ms
   * @param settings
   * @returns
   */
  async acquireLock(
    resources: string[],
    duration: number,
    settings?: Partial<Settings>,
  ): Promise<Lock | null> {
    try {
      return await this.acquire(resources, duration, settings)
    } catch {
      return null
    }
  }
}
