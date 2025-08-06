import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { EvmTransportService } from './services/evm-transport.service';

@Module({
  imports: [ConfigModule],
  providers: [EvmTransportService],
  exports: [EvmTransportService],
})
export class EvmCoreModule {}