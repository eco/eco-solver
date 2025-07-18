import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from './rhinestone-websocket.service'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'

@Module({
  imports: [EventEmitterModule.forRoot(), EcoConfigModule],
  providers: [RhinestoneWebsocketService],
  exports: [RhinestoneWebsocketService],
})
export class RhinestoneModule {}
