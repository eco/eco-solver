import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './services/rhinestone-websocket.service'
import { RhinestoneService } from './services/rhinestone.service'
import { RhinestoneApiService } from './services/rhinestone-api.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [EventEmitterModule.forRoot(), EcoConfigModule, TransactionModule],
  providers: [RhinestoneWebsocketService, RhinestoneService, RhinestoneApiService],
  exports: [RhinestoneWebsocketService, RhinestoneService, RhinestoneApiService],
})
export class RhinestoneModule {}
