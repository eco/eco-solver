import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging';

import { BasicWalletFactory } from './basic-wallet.factory';

/**
 * Module for SVM BasicWallet functionality
 */
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}
