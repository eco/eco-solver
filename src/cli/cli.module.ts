import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { EnvGeneratorService } from './services/env-generator.service';

@Module({
  imports: [ConfigModule],
  providers: [EnvGeneratorService],
  exports: [EnvGeneratorService],
})
export class CliModule {}
