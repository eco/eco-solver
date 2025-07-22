import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './services/rhinestone-websocket.service'
import { RhinestoneService } from './services/rhinestone.service'
import { RhinestoneApiService } from './services/rhinestone-api.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { RhinestoneConfigService } from '@/rhinestone/services/rhinestone-config.service'
import { RhinestoneValidatorService } from '@/rhinestone/services/rhinestone-validator.service'

@Module({
  imports: [EventEmitterModule.forRoot(), EcoConfigModule, TransactionModule],
  providers: [
    RhinestoneService,
    RhinestoneApiService,
    RhinestoneConfigService,
    RhinestoneWebsocketService,
    RhinestoneValidatorService,
  ],
})
export class RhinestoneModule {}
