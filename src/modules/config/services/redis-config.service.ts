import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisConfig } from '@/config/schemas';

@Injectable()
export class RedisConfigService {
  constructor(private configService: ConfigService) {}

  get url(): RedisConfig['url'] {
    return this.configService.get<string>('redis.url')!;
  }

  get host(): RedisConfig['host'] {
    return this.configService.get<string>('redis.host')!;
  }

  get port(): RedisConfig['port'] {
    return this.configService.get<number>('redis.port')!;
  }

  get password(): RedisConfig['password'] {
    return this.configService.get<string>('redis.password');
  }
}
