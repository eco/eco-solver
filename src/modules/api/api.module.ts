import { Module } from '@nestjs/common';

import { BlockchainApiModule } from './blockchain/blockchain.module';
import { GaslessIntentsModule } from './gasless-intents/gasless-intents.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [QuotesModule, BlockchainApiModule, GaslessIntentsModule],
  exports: [QuotesModule, BlockchainApiModule, GaslessIntentsModule],
})
export class ApiModule {}
