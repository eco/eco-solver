import { Injectable } from '@nestjs/common';

import Redis, { Cluster } from 'ioredis';

import { RedisConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';
import { BullMQOtelFactory } from '@/modules/opentelemetry/bullmq-otel.factory';

/**
 * Factory service for creating Redis connections for BullMQ processors.
 * This is needed because @Processor decorators create their own Worker instances
 * with their own connections, separate from BullModule.forRoot.
 */
@Injectable()
export class RedisConnectionFactory {
  constructor(
    private readonly logger: Logger,
    private readonly redisConfig: RedisConfigService,
    private readonly bullMQOtelFactory: BullMQOtelFactory,
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
   * Returns configuration with prefix, telemetry, and optional cluster connection.
   */
  getQueueConfig(queueName: string): any {
    const prefix = `{${queueName}}`;
    const telemetry = this.bullMQOtelFactory.getInstance();

    const config: any = {
      prefix,
      ...(telemetry && { telemetry }),
    };

    if (this.redisConfig.enableCluster) {
      this.logger.info('Configuring queue with Redis cluster', { queueName });
      config.connection = this.createClusterConnection();
    }

    return config;
  }

  /**
   * Gets processor configuration options for BullMQ worker registration.
   * Returns configuration with prefix, telemetry, and optional cluster connection.
   */
  getProcessorConfig(queueName: string): any {
    const prefix = `{${queueName}}`;
    const telemetry = this.bullMQOtelFactory.getInstance();

    const config: any = {
      prefix,
      ...(telemetry && { telemetry }),
    };

    if (this.redisConfig.enableCluster) {
      this.logger.info('Configuring processor with Redis cluster', { queueName });
      config.connection = this.createClusterConnection();
    }

    return config;
  }

  private createClusterConnection(): Cluster {
    const clusterNodes = this.redisConfig.clusterNodes || [
      { host: this.redisConfig.host, port: this.redisConfig.port },
    ];

    this.logger.info('Creating Redis cluster connection', {
      nodeCount: clusterNodes.length,
      nodes: clusterNodes,
    });

    // Check if we're using TLS (ElastiCache in-transit encryption)
    const isTLS = Boolean(this.redisConfig.tls);
    if (isTLS) {
      this.logger.info('TLS configuration detected for Redis cluster');
    }

    // ElastiCache specific cluster configuration
    const cluster = new Redis.Cluster(clusterNodes, {
      dnsLookup: (address, callback) => callback(null, address),
      enableReadyCheck: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      retryDelayOnTryAgain: 100,
      slotsRefreshTimeout: 10000,
      slotsRefreshInterval: 60000,
      clusterRetryStrategy: (times: number, reason?: Error) => {
        this.logger.warn('Retrying cluster connection', {
          attempt: times,
          error: reason?.message || 'Unknown error',
        });
        return Math.min(100 * times, 2000);
      },
      redisOptions: {
        username: this.redisConfig.username,
        password: this.redisConfig.password,
        tls: isTLS
          ? {
              ...this.redisConfig.tls,
              // ElastiCache specific TLS settings
              rejectUnauthorized: false, // ElastiCache uses self-signed certs
              checkServerIdentity: () => undefined, // Skip hostname verification for ElastiCache
            }
          : undefined,
        connectTimeout: 10000,
        enableReadyCheck: true,
        maxRetriesPerRequest: null,
      },
      ...this.redisConfig.clusterOptions,
    });

    // Add error event handlers for better debugging
    cluster.on('error', (error) => {
      this.logger.error('Redis cluster error', error);
    });

    cluster.on('node error', (error, address) => {
      this.logger.error('Redis node error', error, { address });
    });

    cluster.on('+node', (node) => {
      this.logger.info('Redis cluster node added', {
        host: node.options.host,
        port: node.options.port,
      });
    });

    cluster.on('-node', (node) => {
      this.logger.warn('Redis cluster node removed', {
        host: node.options.host,
        port: node.options.port,
      });
    });

    return cluster;
  }

  private createStandaloneConnection(): Redis {
    this.logger.info('Creating Redis standalone connection', {
      host: this.redisConfig.host,
      port: this.redisConfig.port,
    });

    return new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      username: this.redisConfig.username,
      password: this.redisConfig.password,
      tls: this.redisConfig.tls,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        this.logger.error('Failed to connect to Redis', {
          attempt: times,
          host: this.redisConfig.host,
          port: this.redisConfig.port,
        });
        return Math.min(times * 50, 2000);
      },
    });
  }
}
