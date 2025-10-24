import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BlockchainController } from './controllers/blockchain.controller';
import { BlockchainInfoService } from './services/blockchain-info.service';

@Module({
  imports: [ConfigModule, LoggingModule],
  controllers: [BlockchainController],
  providers: [BlockchainInfoService],
  exports: [BlockchainInfoService],
})
export class BlockchainApiModule {}
