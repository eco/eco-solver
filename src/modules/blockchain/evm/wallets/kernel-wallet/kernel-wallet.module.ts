import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { EvmTransportService } from '../../services/evm-transport.service';

import { KernelWalletFactory } from './kernel-wallet.factory';

@Module({
  imports: [ConfigModule],
  providers: [EvmTransportService, KernelWalletFactory],
  exports: [KernelWalletFactory],
})
export class KernelWalletModule {}
