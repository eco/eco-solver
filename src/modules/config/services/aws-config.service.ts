import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AwsConfig } from '@/modules/config/interfaces';

@Injectable()
export class AwsConfigService implements AwsConfig {
  constructor(private configService: ConfigService) {}

  get region(): string {
    return this.configService.get<string>('aws.region');
  }

  get secretName(): string {
    return this.configService.get<string>('aws.secretName');
  }

  get useAwsSecrets(): boolean {
    return this.configService.get<boolean>('aws.useAwsSecrets');
  }

  get accessKeyId(): string | undefined {
    return this.configService.get<string>('aws.accessKeyId');
  }

  get secretAccessKey(): string | undefined {
    return this.configService.get<string>('aws.secretAccessKey');
  }
}
