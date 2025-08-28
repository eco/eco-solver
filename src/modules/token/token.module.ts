import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { TokenConfigService } from './services/token-config.service';

/**
 * Token Module
 * Provides chain-agnostic token configuration and operations
 */
@Module({
  imports: [ConfigModule],
  providers: [TokenConfigService],
  exports: [TokenConfigService],
})
export class TokenModule {}
