import { BalanceModule } from '@/balance/balance.module'
import { CacheModule } from '@nestjs/cache-manager'
import { CCTPLiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-LiFi/cctp-lifi-provider.service'
import { CCTPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP/cctp-provider.service'
import { CCTPV2ProviderService } from '@/liquidity-manager/services/liquidity-providers/CCTP-V2/cctpv2-provider.service'
import { EverclearProviderService } from '@/liquidity-manager/services/liquidity-providers/Everclear/everclear-provider.service'
import { GatewayProviderService } from '@/liquidity-manager/services/liquidity-providers/Gateway/gateway-provider.service'
import { IntentModule } from '@/intent/intent.module'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { LiquidityManagerProcessor } from '@/liquidity-manager/processors/eco-protocol-intents.processor'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RebalanceModel, RebalanceSchema } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'

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
    GatewayProviderService,
    RebalanceRepository,
  ],
  exports: [LiquidityManagerService, RebalanceRepository],
})
export class LiquidityManagerModule {}
