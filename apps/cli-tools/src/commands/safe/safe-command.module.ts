import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { TransferCommandModule } from '../transfer/transfer-command.module'
import { SafeCommand } from './safe.command'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [SafeCommand],
  exports: [SafeCommand],
})
export class SafeCommandModule {}
