import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisConfig } from '@/config/schemas';

@Injectable()
export class RedisConfigService {
  constructor(private configService: ConfigService) {}

  get host(): RedisConfig['host'] {
    return this.configService.get<string>('redis.host')!;
  }

  get port(): RedisConfig['port'] {
    return this.configService.get<number>('redis.port')!;
  }

  get username(): RedisConfig['username'] {
    return this.configService.get<string>('redis.username');
  }

  get password(): RedisConfig['password'] {
    return this.configService.get<string>('redis.password');
  }

  get tls(): RedisConfig['tls'] {
    return this.configService.get('redis.tls');
  }

  get enableCluster(): RedisConfig['enableCluster'] {
    return this.configService.get<boolean>('redis.enableCluster')!;
  }

  get clusterNodes(): RedisConfig['clusterNodes'] {
    return this.configService.get('redis.clusterNodes');
  }

  get clusterOptions(): RedisConfig['clusterOptions'] {
    return this.configService.get('redis.clusterOptions');
  }
}
