import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { RhinestoneWebsocketService } from '../services/rhinestone-websocket.service'
import { RhinestoneTestController } from './rhinestone-test.controller'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MockEcoConfigService } from './mocks/eco-config.service.mock'
import { RhinestoneService } from '@/rhinestone/services/rhinestone.service'

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [RhinestoneTestController],
  providers: [
    {
      provide: EcoConfigService,
      useClass: MockEcoConfigService,
    },
    RhinestoneWebsocketService,
    RhinestoneService,
  ],
})
export class RhinestoneStandaloneModule {}
