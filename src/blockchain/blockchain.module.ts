import { Module } from '@nestjs/common'
import { BlockchainService } from './blockchain.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { IntentModule } from '@/intent/intent.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { BalanceModule } from '@/balance/balance.module'

@Module({
  imports: [
    BalanceModule,
    EcoConfigModule,
    IntentModule,
    TransactionModule,
    LiquidityManagerModule,
  ],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
