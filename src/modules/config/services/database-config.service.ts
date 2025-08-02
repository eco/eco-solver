import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseConfig } from '@/modules/config/interfaces';

@Injectable()
export class DatabaseConfigService implements DatabaseConfig {
  constructor(private configService: ConfigService) {}

  get uri(): string {
    return this.configService.get<string>('mongodb.uri');
  }
}
