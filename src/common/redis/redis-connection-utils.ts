import { Logger } from '@nestjs/common'
import { RegisterQueueOptions } from '@nestjs/bullmq'
import * as Redis from 'ioredis'
import { EcoError } from '../errors/eco-error'
import { EcoLogMessage } from '../logging/eco-log-message'
import { QueueMetadata } from './constants'
import { RedisConfig } from '../../eco-configs/eco-config.types'
import { Redis as IORedisClient, Cluster as IORedisCluster } from 'ioredis'

type RedlockRedisClient = IORedisClient | IORedisCluster

export class RedisConnectionUtils {
  private static logger = new Logger(RedisConnectionUtils.name)

  static getRedisConnection(redisConfig: RedisConfig): Redis.Redis | Redis.Cluster {
    const connection = redisConfig.connection

    if (this.isClusterConnection(connection)) {
      return new Redis.Cluster(
        connection as Redis.ClusterNode[],
        RedisConnectionUtils.getClusterOptions(redisConfig),
      )
    }

    return new Redis.Redis(connection as Redis.RedisOptions)
  }

  static getQueueOptions(queue: QueueMetadata, redisConfig: RedisConfig): RegisterQueueOptions {
    try {
      const connection = redisConfig.connection
      const { queue: name, prefix } = queue

      if (this.isClusterConnection(connection)) {
        return this.getQueueOptionsForCluster(
          name,
          prefix,
          connection as Redis.ClusterNode[],
          redisConfig,
        )
      }

      return {
        name,
        prefix,
        connection,
      } as RegisterQueueOptions
    } catch (ex) {
      EcoError.logErrorWithStack(
        ex.message,
        `getQueueOptions: Invalid queue configuration`,
        this.logger,
        {
          queue,
        },
      )

      throw ex
    }
  }

  static getClientsForRedlock(redisConfig: RedisConfig): RedlockRedisClient[] {
    const connection = redisConfig.connection
    if (this.isClusterConnection(connection)) {
      return [
        new Redis.Cluster(
          connection as Redis.ClusterNode[],
          RedisConnectionUtils.getClusterOptions(redisConfig),
        ),
      ]
    }

    return [new Redis.Redis(connection as Redis.RedisOptions)]
  }

  private static isClusterConnection(connection: Redis.ClusterNode | Redis.ClusterNode[]): boolean {
    return Array.isArray(connection)
  }

  private static getQueueOptionsForCluster(
    name: string,
    prefix: string,
    connection: Redis.ClusterNode[],
    redisConfig: RedisConfig,
  ): RegisterQueueOptions {
    // Setup a cluster.
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getQueueOptionsForCluster: Setting up a redis cluster`,
      }),
    )

    return {
      name,
      prefix,
      connection: new Redis.Cluster(
        connection,
        RedisConnectionUtils.getClusterOptions(redisConfig),
      ),
    } as RegisterQueueOptions
  }

  private static getClusterOptions(redisConfig: RedisConfig): Redis.ClusterOptions {
    return {
      ...redisConfig.options.cluster,
      redisOptions: redisConfig.options.single,
    }
  }
}
