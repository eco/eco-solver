import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { IntentModule } from '@/intent/intent.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { RhinestoneService } from '@/rhinestone/services/rhinestone.service'
import { RhinestoneApiService } from '@/rhinestone/services/rhinestone-api.service'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { RhinestoneWebsocketService } from '@/rhinestone/services/rhinestone-websocket.service'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RhinestoneContractsService } from '@/rhinestone/services/rhinestone-contracts.service'
import { ONE_HOUR } from '@/common/time'

@Module({
  imports: [
    TransactionModule,
    IntentModule,
    EventEmitterModule.forRoot(),
    CacheModule.registerAsync({
      useFactory: async (configService: EcoConfigService) =>
        configService.getRhinestone().cache ?? { ttl: ONE_HOUR },
      inject: [EcoConfigService],
    }),
  ],
  providers: [
    RhinestoneService,
    RhinestoneApiService,
    RhinestoneConfigService,
    RhinestoneWebsocketService,
    RhinestoneValidatorService,
    RhinestoneContractsService,
  ],
})
export class RhinestoneModule {}
