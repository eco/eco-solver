import { BalanceService } from '../../balance/balance.service'
import { BalanceCommand } from './balance.command'
import { TransferCommandModule } from '../transfer/transfer-command.module'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [BalanceCommand, BalanceService],
  exports: [BalanceCommand],
})
export class BalanceCommandModule {}
