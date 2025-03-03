import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceModule } from '@/balance/balance.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { RebalanceModel, RebalanceSchema } from '@/liquidity-manager/schemas/rebalance.schema'

@Module({
  imports: [
    BalanceModule,
    TransactionModule,
    LiquidityManagerQueue.init(),
    LiquidityManagerQueue.initFlow(),

    MongooseModule.forFeature([{ name: RebalanceModel.name, schema: RebalanceSchema }]),
  ],
  providers: [
    LiquidityManagerService,
    LiquidityManagerProcessor,
    LiquidityProviderService,
    LiFiProviderService,
  ],
  exports: [LiquidityManagerService],
})
export class LiquidityManagerModule {}
