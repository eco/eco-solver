import { Module } from '@nestjs/common';

import { BlockchainApiModule } from './blockchain/blockchain.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [QuotesModule, BlockchainApiModule],
  exports: [QuotesModule, BlockchainApiModule],
})
export class ApiModule {}
