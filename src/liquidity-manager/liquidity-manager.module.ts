import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceModule } from '@/balance/balance.module'
import { IntentModule } from '@/intent/intent.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { RebalanceModel, RebalanceSchema } from '@/liquidity-manager/schemas/rebalance.schema'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { CCTPLiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'
import { RebalancingProviderService } from '@/liquidity-manager/services/liquidity-providers/Rebalancing/rebalancing-provider.service'
import { LitActionsModule } from '@/lit-actions/lit-actions.module'

@Module({
  imports: [
    CacheModule.register(),
    BalanceModule,
    IntentModule,
    LitActionsModule,
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
    CCTPProviderService,
    WarpRouteProviderService,
    CCTPLiFiProviderService,
    RelayProviderService,
    StargateProviderService,
    SquidProviderService,
    CCTPV2ProviderService,
    EverclearProviderService,
    RebalancingProviderService,
  ],
  exports: [LiquidityManagerService],
})
export class LiquidityManagerModule {}
