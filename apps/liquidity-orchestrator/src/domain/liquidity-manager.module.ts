import { Module, CacheModule } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BalanceModule } from './balance.module'
import { LiquidityManagerService } from './services/liquidity-manager.service'
import { LiquidityManagerProcessor } from './processors/eco-protocol-intents.processor'
import { LiquidityProviderService } from './services/liquidity-provider.service'
import { LiFiProviderService } from './services/liquidity-providers/LiFi/lifi-provider.service'
import { CCTPProviderService } from './services/liquidity-providers/CCTP/cctp-provider.service'
import { WarpRouteProviderService } from './services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { CCTPLiFiProviderService } from './services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { RelayProviderService } from './services/liquidity-providers/Relay/relay-provider.service'
import { StargateProviderService } from './services/liquidity-providers/Stargate/stargate-provider.service'
import { SquidProviderService } from './services/liquidity-providers/Squid/squid-provider.service'
import { CCTPV2ProviderService } from './services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from './services/liquidity-providers/Everclear/everclear-provider.service'
import { LiquidityManagerQueue } from './queues/liquidity-manager.queue'
import { RebalanceModel, RebalanceSchema } from './schemas/rebalance.schema'
import { TransactionModule } from '@libs/integrations'
import { IntentModule } from '@libs/domain'

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
