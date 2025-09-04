import { Injectable, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';

import { RedisConfigService } from '@/modules/config/services';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private redisConfig: RedisConfigService) {
    if (this.redisConfig.url) {
      this.client = new Redis(this.redisConfig.url);
    } else {
      this.client = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
      });
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
