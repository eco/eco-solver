import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { VaultWalletFactory } from './vault-wallet.factory';

/**
 * Module for SVM VaultWallet functionality
 */
@Module({
  imports: [ConfigModule, LoggingModule, OpenTelemetryModule],
  providers: [VaultWalletFactory],
  exports: [VaultWalletFactory],
})
export class VaultWalletModule {}
