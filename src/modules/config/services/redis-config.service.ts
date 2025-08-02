import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '@/modules/config/interfaces';

@Injectable()
export class RedisConfigService implements RedisConfig {
  constructor(private configService: ConfigService) {}

  get host(): string {
    return this.configService.get<string>('redis.host');
  }

  get port(): number {
    return this.configService.get<number>('redis.port');
  }

  get password(): string | undefined {
    return this.configService.get<string>('redis.password');
  }
}