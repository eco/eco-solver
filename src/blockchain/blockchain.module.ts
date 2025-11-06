import { Module } from '@nestjs/common'
import { BlockchainService } from './blockchain.service'
import { IntentModule } from '@/intent/intent.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { BalanceModule } from '@/balance/balance.module'

@Module({
  imports: [BalanceModule, IntentModule, TransactionModule, LiquidityManagerModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
