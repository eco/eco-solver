import { Module } from '@nestjs/common';

import { TvmTransportService } from '../../services/tvm-transport.service';
import { BasicWalletFactory } from './basic-wallet.factory';

@Module({
  providers: [TvmTransportService, BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}