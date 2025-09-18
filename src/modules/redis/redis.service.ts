import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';

import { RedisConfigService } from '@/modules/config/services';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private redisConfig: RedisConfigService) {
    this.client = new Redis({
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      username: this.redisConfig.username,
      password: this.redisConfig.password,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
