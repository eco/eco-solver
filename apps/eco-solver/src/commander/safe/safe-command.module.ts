import { SafeCommand } from './safe.command'
import { TransferCommandModule } from '../transfer/transfer-command.module'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [SafeCommand],
  exports: [SafeCommand],
})
export class SafeCommandModule {}
