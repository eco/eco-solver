import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { IntentModule } from '@/intent/intent.module'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { RhinestoneService } from '@/rhinestone/services/rhinestone.service'
import { RhinestoneApiService } from '@/rhinestone/services/rhinestone-api.service'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { RhinestoneWebsocketService } from '@/rhinestone/services/rhinestone-websocket.service'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'

@Module({
  imports: [EventEmitterModule.forRoot(), EcoConfigModule, TransactionModule, IntentModule],
  providers: [
    RhinestoneService,
    RhinestoneApiService,
    RhinestoneConfigService,
    RhinestoneWebsocketService,
    RhinestoneValidatorService,
  ],
})
export class RhinestoneModule {}
