import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Redis, { Cluster } from 'ioredis';

import { RedisConnectionFactory } from './redis-connection.factory';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | Cluster;

  constructor(private connectionFactory: RedisConnectionFactory) {
    this.client = this.connectionFactory.createConnection();
  }

  getClient(): Redis | Cluster {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
