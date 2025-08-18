import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceModule } from '@eco-solver/balance/balance.module'
import { IntentModule } from '@eco-solver/intent/intent.module'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'
import { LiquidityManagerQueue } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@eco-solver/liquidity-manager/services/liquidity-manager.service'
import { LiquidityManagerProcessor } from '@eco-solver/liquidity-manager/processors/eco-protocol-intents.processor'
import { LiquidityProviderService } from '@eco-solver/liquidity-manager/services/liquidity-provider.service'
import { LiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { RebalanceModel, RebalanceSchema } from '@eco-solver/liquidity-manager/schemas/rebalance.schema'
import { CCTPProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { CCTPLiFiProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { RelayProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { SquidProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@eco-solver/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'

@Module({
  imports: [
    CacheModule.register(),
    BalanceModule,
    IntentModule,
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
  ],
  exports: [LiquidityManagerService],
})
export class LiquidityManagerModule {}
