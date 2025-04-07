import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [],

  controllers: [],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService],
})
export class IntentInitiationModule {}
