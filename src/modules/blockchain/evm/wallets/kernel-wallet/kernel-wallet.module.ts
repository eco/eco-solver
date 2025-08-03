import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { KernelWalletFactory } from './kernel-wallet.factory';

@Module({
  imports: [ConfigModule],
  providers: [KernelWalletFactory],
  exports: [KernelWalletFactory],
})
export class KernelWalletModule {}
