import { BalanceService } from '@eco-solver/balance/balance.service'
import { BalanceCommand } from '@eco-solver/commander/balance/balance.command'
import { TransferCommandModule } from '@eco-solver/commander/transfer/transfer-command.module'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [BalanceCommand, BalanceService],
  exports: [BalanceCommand],
})
export class BalanceCommandModule {}
