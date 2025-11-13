import { Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BlockchainApiModule } from './blockchain/blockchain.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [ConfigModule, LoggingModule, BlockchainApiModule, QuotesModule],
  exports: [BlockchainApiModule],
})
export class ApiModule implements OnModuleInit {
  constructor(
    private readonly quotesConfigService?: QuotesConfigService,
    private readonly logger?: SystemLoggerService,
  ) {}

  onModuleInit() {
    if (this.quotesConfigService && this.logger) {
      if (this.quotesConfigService.isEnabled) {
        this.logger.log('Quotes API enabled at /api/v1/quotes');
      } else {
        this.logger.log('Quotes API disabled');
      }
    }
  }
}
