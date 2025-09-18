import { Injectable } from '@nestjs/common';

import Redis, { Cluster } from 'ioredis';

import { RedisConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';

/**
 * Factory service for creating Redis connections for BullMQ processors.
 * This is needed because @Processor decorators create their own Worker instances
 * with their own connections, separate from BullModule.forRoot.
 */
@Injectable()
export class RedisConnectionFactory {
  constructor(
    private redisConfig: RedisConfigService,
    private logger: SystemLoggerService,
  ) {
    this.logger.setContext(RedisConnectionFactory.name);
  }

  /**
   * Creates a Redis connection for BullMQ workers.
   * Returns either a Cluster or standalone Redis instance based on configuration.
   */
  createConnection(): Redis | Cluster {
    if (this.redisConfig.enableCluster) {
      return this.createClusterConnection();
    } else {
      return this.createStandaloneConnection();
    }
  }

  /**
   * Gets queue configuration options for BullMQ queue registration.
   * Returns configuration with prefix and optional cluster connection.
   */
  getQueueConfig(queueName: string): any {
    const prefix = `{${queueName}}`;

    if (this.redisConfig.enableCluster) {
      this.logger.log(`Configuring ${queueName} queue with Redis cluster`);
      return {
        prefix,
        connection: this.createClusterConnection(),
      };
    }

    return { prefix };
  }

  private createClusterConnection(): Cluster {
    const clusterNodes = this.redisConfig.clusterNodes || [
      { host: this.redisConfig.host, port: this.redisConfig.port },
    ];

    this.logger.log(`Creating Redis cluster connection with ${clusterNodes.length} nodes`);

    return new Redis.Cluster(clusterNodes, {
      redisOptions: {
        username: this.redisConfig.username,
        password: this.redisConfig.password,
        tls: this.redisConfig.tls,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      ...this.redisConfig.clusterOptions,
    });
  }

  private createStandaloneConnection(): Redis {
    this.logger.log(
      `Creating Redis standalone connection at ${this.redisConfig.host}:${this.redisConfig.port}`,
    );

    return new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      username: this.redisConfig.username,
      password: this.redisConfig.password,
      tls: this.redisConfig.tls,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        this.logger.error(
          `Failed to connect to Redis (attempt ${times}): ${this.redisConfig.host}:${this.redisConfig.port}`,
        );
        return Math.min(times * 50, 2000);
      },
    });
  }
}
