import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { AwsSchema } from '@/config/config.schema';

type AwsConfig = z.infer<typeof AwsSchema>;

@Injectable()
export class AwsConfigService {
  constructor(private configService: ConfigService) {}

  get region(): AwsConfig['region'] {
    return this.configService.get<string>('aws.region');
  }

  get secretName(): AwsConfig['secretName'] {
    return this.configService.get<string>('aws.secretName');
  }

  get useAwsSecrets(): boolean {
    return Boolean(this.secretName);
  }

  get accessKeyId(): AwsConfig['accessKeyId'] {
    return this.configService.get<string>('aws.accessKeyId');
  }

  get secretAccessKey(): AwsConfig['secretAccessKey'] {
    return this.configService.get<string>('aws.secretAccessKey');
  }
}
