import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CacheModule } from '@nestjs/cache-manager'
import { BullModule } from '@nestjs/bullmq'
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service'
import { RhinestoneTestController } from './rhinestone-test.controller'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MockEcoConfigService } from './mocks/eco-config.service.mock'
import { RhinestoneService } from '@/rhinestone/services/rhinestone.service'
import { RhinestoneApiService } from '@/rhinestone/services/rhinestone-api.service'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { MockWalletClientService } from './mocks/wallet-client.service.mock'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { MockKernelAccountClientService } from './mocks/kernel-account-client.service.mock'
import { SignerService } from '@/sign/signer.service'
import { MockSignerService } from './mocks/signer.service.mock'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'
import { RhinestoneContractsService } from '@/rhinestone/services/rhinestone-contracts.service'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { ValidationService } from '@/intent/validation.sevice'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { MockMultichainPublicClientService } from './mocks/multichain-public-client.service.mock'
import { EcoAnalyticsService } from '@/analytics'
import { MockEcoAnalyticsService } from './mocks/eco-analytics.service.mock'
import { FeeService } from '@/fee/fee.service'
import { ProofService } from '@/prover/proof.service'
import { MockProofService } from './mocks/proof.service.mock'
import { BalanceService } from '@/balance/balance.service'
import { MockIntentModel } from './mocks/intent-model.mock'
import { QUEUES } from '@/common/redis/constants'

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CacheModule.register({
      ttl: 300,
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: QUEUES.SOURCE_INTENT.queue,
    }),
  ],
  controllers: [RhinestoneTestController],
  providers: [
    {
      provide: EcoConfigService,
      useClass: MockEcoConfigService,
    },
    {
      provide: WalletClientDefaultSignerService,
      useClass: MockWalletClientService,
    },
    {
      provide: KernelAccountClientService,
      useClass: MockKernelAccountClientService,
    },
    {
      provide: SignerService,
      useClass: MockSignerService,
    },
    {
      provide: MultichainPublicClientService,
      useClass: MockMultichainPublicClientService,
    },
    {
      provide: EcoAnalyticsService,
      useClass: MockEcoAnalyticsService,
    },
    {
      provide: ProofService,
      useClass: MockProofService,
    },
    {
      provide: 'IntentSourceModelModel',
      useClass: MockIntentModel,
    },
    FeeService,
    BalanceService,
    RhinestoneValidatorService,
    RhinestoneContractsService,
    ValidateIntentService,
    ValidationService,
    UtilsIntentService,
    RhinestoneConfigService,
    RhinestoneApiService,
    RhinestoneWebsocketService,
    RhinestoneService,
  ],
})
export class RhinestoneStandaloneModule {}
