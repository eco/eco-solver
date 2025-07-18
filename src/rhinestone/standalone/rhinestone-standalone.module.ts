import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service'
import { RhinestoneTestController } from './rhinestone-test.controller'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MockEcoConfigService } from './mocks/eco-config.service.mock'
import { RhinestoneService } from '@/rhinestone/services/rhinestone.service'
import { RhinestoneApiService } from '@/rhinestone/services/rhinestone-api.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { MockWalletClientService } from './mocks/wallet-client.service.mock'
import { SignerService } from '@/sign/signer.service'
import { MockSignerService } from './mocks/signer.service.mock'

@Module({
  imports: [EventEmitterModule.forRoot()],
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
      provide: SignerService,
      useClass: MockSignerService,
    },
    RhinestoneApiService,
    RhinestoneWebsocketService,
    RhinestoneService,
  ],
})
export class RhinestoneStandaloneModule {}
