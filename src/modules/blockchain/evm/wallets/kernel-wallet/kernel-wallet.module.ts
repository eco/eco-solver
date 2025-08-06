import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { EvmCoreModule } from '../../evm-core.module';

import { KernelWalletFactory } from './kernel-wallet.factory';

@Module({
  imports: [ConfigModule, EvmCoreModule],
  providers: [KernelWalletFactory],
  exports: [KernelWalletFactory],
})
export class KernelWalletModule {}
