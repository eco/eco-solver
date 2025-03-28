import { IntentInitiationController } from './controllers/intent-initiation.controller'
import { IntentInitiationService } from './services/intent-initiation.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [],

  controllers: [IntentInitiationController],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService],
})
export class IntentInitiationModule {}
