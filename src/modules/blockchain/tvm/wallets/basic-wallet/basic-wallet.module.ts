import { Module } from '@nestjs/common';

import { BasicWalletFactory } from './basic-wallet.factory';

@Module({
  providers: [BasicWalletFactory],
  exports: [BasicWalletFactory],
})
export class BasicWalletModule {}