import { Module } from '@nestjs/common';

import { EvmModule } from '@/modules/blockchain/evm/evm.module';
import { SvmModule } from '@/modules/blockchain/svm/svm.module';
import { TvmModule } from '@/modules/blockchain/tvm/tvm.module';
import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { BlockchainController } from './controllers/blockchain.controller';
import { BlockchainInfoService } from './services/blockchain-info.service';

@Module({
  imports: [ConfigModule, LoggingModule, EvmModule, SvmModule, TvmModule],
  controllers: [BlockchainController],
  providers: [BlockchainInfoService],
  exports: [BlockchainInfoService],
})
export class BlockchainApiModule {}
