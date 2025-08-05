import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { EvmTransportService } from '../../services/evm-transport.service';

import { BasicWalletFactory } from './basic-wallet.factory';

@Module({
  imports: [ConfigModule],
  providers: [EvmTransportService, BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}
