import { IntentInitiationController } from '@/intent-initiation/controllers/intent-initiation.controller'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [],

  controllers: [IntentInitiationController],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService],
})
export class IntentInitiationModule {}
