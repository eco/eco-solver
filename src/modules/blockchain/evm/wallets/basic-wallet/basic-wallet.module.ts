import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { BasicWalletFactory } from './basic-wallet.factory';

@Module({
  imports: [ConfigModule],
  providers: [BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}
