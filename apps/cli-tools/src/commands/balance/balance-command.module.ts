import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { BalanceService } from '@libs/domain'
import { TransferCommandModule } from '../transfer/transfer-command.module'
import { BalanceCommand } from './balance.command'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [BalanceCommand, BalanceService],
  exports: [BalanceCommand],
})
export class BalanceCommandModule {}
