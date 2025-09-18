import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Redis, { Cluster } from 'ioredis';

import { RedisConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | Cluster;

  constructor(
    private redisConfig: RedisConfigService,
    private logger: SystemLoggerService,
  ) {
    this.logger.setContext(RedisService.name);

    if (this.redisConfig.enableCluster) {
      this.logger.log('Initializing Redis in cluster mode');
      this.initializeClusterClient();
    } else {
      this.logger.log('Initializing Redis in standalone mode');
      this.initializeStandaloneClient();
    }
  }

  private initializeClusterClient(): void {
    const clusterNodes = this.redisConfig.clusterNodes || [
      { host: this.redisConfig.host, port: this.redisConfig.port },
    ];

    this.client = new Redis.Cluster(clusterNodes, {
      redisOptions: {
        username: this.redisConfig.username,
        password: this.redisConfig.password,
        tls: this.redisConfig.tls,
      },
      ...this.redisConfig.clusterOptions,
    });

    this.logger.log(`Redis cluster initialized with ${clusterNodes.length} nodes`);
  }

  private initializeStandaloneClient(): void {
    this.client = new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      username: this.redisConfig.username,
      password: this.redisConfig.password,
      tls: this.redisConfig.tls,
    });

    this.logger.log(
      `Redis standalone initialized at ${this.redisConfig.host}:${this.redisConfig.port}`,
    );
  }

  getClient(): Redis | Cluster {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
