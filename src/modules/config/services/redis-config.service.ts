import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { RedisSchema } from '@/config/config.schema';

type RedisConfig = z.infer<typeof RedisSchema>;

@Injectable()
export class RedisConfigService {
  constructor(private configService: ConfigService) {}

  get host(): RedisConfig['host'] {
    return this.configService.get<string>('redis.host');
  }

  get port(): RedisConfig['port'] {
    return this.configService.get<number>('redis.port');
  }

  get password(): RedisConfig['password'] {
    return this.configService.get<string>('redis.password');
  }
}
