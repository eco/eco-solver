import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { BalanceCommand } from '@/commander/balance/balance.command'
import { TransferCommandModule } from '@/commander/transfer/transfer-command.module'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'

@Module({
  imports: [CacheModule.register(), TransferCommandModule],
  providers: [BalanceCommand, RpcBalanceService],
  exports: [BalanceCommand],
})
export class BalanceCommandModule {}
