import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { z } from 'zod';

import { MongoDBSchema } from '@/config/config.schema';

type DatabaseConfig = z.infer<typeof MongoDBSchema>;

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  get uri(): DatabaseConfig['uri'] {
    return this.configService.get<string>('mongodb.uri');
  }
}
