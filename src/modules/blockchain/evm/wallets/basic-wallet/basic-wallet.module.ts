import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { EvmCoreModule } from '../../evm-core.module';

import { BasicWalletFactory } from './basic-wallet.factory';

@Module({
  imports: [ConfigModule, EvmCoreModule],
  providers: [BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}
