import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { ConfigSchema } from '@/config/config.schema';

type AppConfig = Pick<z.infer<typeof ConfigSchema>, 'port' | 'env'>;

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): AppConfig['port'] {
    return this.configService.get<number>('port');
  }

  get env(): AppConfig['env'] {
    return this.configService.get<string>('env');
  }
}
