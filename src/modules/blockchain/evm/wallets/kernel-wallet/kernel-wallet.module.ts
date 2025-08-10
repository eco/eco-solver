import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { EvmCoreModule } from '../../evm-core.module';

import { KernelWalletFactory } from './kernel-wallet.factory';

@Module({
  imports: [ConfigModule, EvmCoreModule, LoggingModule, OpenTelemetryModule],
  providers: [KernelWalletFactory],
  exports: [KernelWalletFactory],
})
export class KernelWalletModule {}
