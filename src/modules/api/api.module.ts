import { DynamicModule, Module, OnModuleInit } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { ConfigModule } from '@/modules/config/config.module';
import { QuotesConfigService } from '@/modules/config/services/quotes-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BlockchainApiModule } from './blockchain/blockchain.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({})
export class ApiModule implements OnModuleInit {
  constructor(
    private readonly quotesConfigService?: QuotesConfigService,
    private readonly logger?: SystemLoggerService,
  ) {}

  static async forRootAsync(): Promise<DynamicModule> {
    const config = await configurationFactory();

    const imports = [ConfigModule, LoggingModule, BlockchainApiModule];

    // Default to true if not explicitly set to false
    // This respects the schema default value
    if (config.quotes?.enabled !== false) {
      imports.push(QuotesModule);
    }

    return {
      module: ApiModule,
      imports,
      exports: [BlockchainApiModule],
    };
  }

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
