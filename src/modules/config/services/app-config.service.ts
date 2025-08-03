import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BaseConfig } from '@/config/schemas';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): BaseConfig['port'] {
    return this.configService.get<number>('port', 3000);
  }

  get env(): BaseConfig['env'] {
    return this.configService.get<BaseConfig['env']>('env', 'development');
  }
}
