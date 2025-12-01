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
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { LiquidityManagerService } from '@/liquidity-manager/services/liquidity-manager.service'
import { CheckBalancesProcessor } from '@/liquidity-manager/processors/check-balances.processor'
import { LiquidityProviderService } from '@/liquidity-manager/services/liquidity-provider.service'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RebalanceModel, RebalanceSchema } from '@/liquidity-manager/schemas/rebalance.schema'
import {
  RebalanceQuoteRejectionModel,
  RebalanceQuoteRejectionSchema,
} from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceQuoteRejectionRepository } from '@/liquidity-manager/repositories/rebalance-quote-rejection.repository'
import { RebalancingHealthRepository } from '@/liquidity-manager/repositories/rebalancing-health.repository'
import { RelayProviderService } from '@/liquidity-manager/services/liquidity-providers/Relay/relay-provider.service'
import { SquidProviderService } from '@/liquidity-manager/services/liquidity-providers/Squid/squid-provider.service'
import { StargateProviderService } from '@/liquidity-manager/services/liquidity-providers/Stargate/stargate-provider.service'
import { TransactionModule } from '@/transaction/transaction.module'
import { WarpRouteProviderService } from '@/liquidity-manager/services/liquidity-providers/Hyperlane/warp-route-provider.service'
import { TxSigningQueueService } from '@/liquidity-manager/wallet-wrappers/tx-signing-queue.service'
import { LmTxGatedWalletClientService } from '@/liquidity-manager/wallet-wrappers/wallet-gated-client.service'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { LmTxGatedKernelAccountClientV2Service } from './wallet-wrappers/kernel-gated-client-v2.service'
import { USDT0ProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0/usdt0-provider.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { USDT0LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/USDT0-LiFi/usdt0-lifi-provider.service'
import { CCIPProviderService } from '@/liquidity-manager/services/liquidity-providers/CCIP/ccip-provider.service'
import { CCIPLiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/CCIP-LiFi/ccip-lifi-provider.service'

@Module({
  imports: [
    CacheModule.register(),
    BalanceModule,
    IntentModule,
    TransactionModule,
    LiquidityManagerQueue.init(),
    CheckBalancesQueue.init(),
    LiquidityManagerQueue.initFlow(),

    MongooseModule.forFeature([
      { name: RebalanceModel.name, schema: RebalanceSchema },
      { name: RebalanceQuoteRejectionModel.name, schema: RebalanceQuoteRejectionSchema },
    ]),
  ],
  providers: [
    LiquidityManagerService,
    CheckBalancesProcessor,
    LiquidityManagerProcessor,
    LiquidityProviderService,
    TxSigningQueueService,
    LmTxGatedWalletClientService,
    LmTxGatedKernelAccountClientService,
    LmTxGatedKernelAccountClientV2Service,
    MultichainPublicClientService,
    USDT0LiFiProviderService,
    USDT0ProviderService,
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
    RebalanceQuoteRejectionRepository,
    RebalancingHealthRepository,
    CCIPProviderService,
    CCIPLiFiProviderService,
  ],
  exports: [
    LiquidityManagerService,
    RebalanceRepository,
    RebalanceQuoteRejectionRepository,
    RebalancingHealthRepository,
  ],
})
export class LiquidityManagerModule {}
