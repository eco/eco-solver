import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DataDogConfig } from '@/config/schemas';

@Injectable()
export class DataDogConfigService {
  constructor(private configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.get<boolean>('datadog.enabled', false);
  }

  get host(): string {
    return this.configService.get<string>('datadog.host', 'localhost');
  }

  get port(): number {
    return this.configService.get<number>('datadog.port', 8125);
  }

  get prefix(): string {
    return this.configService.get<string>('datadog.prefix', 'blockchain_intent_solver.');
  }

  get globalTags(): DataDogConfig['globalTags'] {
    return this.configService.get<DataDogConfig['globalTags']>('datadog.globalTags');
  }
}
