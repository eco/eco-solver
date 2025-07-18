import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './services/rhinestone-websocket.service'
import { RhinestoneService } from './services/rhinestone.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [EventEmitterModule.forRoot(), EcoConfigModule, TransactionModule],
  providers: [RhinestoneWebsocketService, RhinestoneService],
  exports: [RhinestoneWebsocketService, RhinestoneService],
})
export class RhinestoneModule {}
