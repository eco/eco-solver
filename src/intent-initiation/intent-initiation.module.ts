import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Module } from '@nestjs/common'
import { PermitValidationModule } from '@/intent-initiation/permit-validation/permit-validation.module'

@Module({
  imports: [PermitValidationModule],

  controllers: [],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService, PermitValidationModule],
})
export class IntentInitiationModule {}
