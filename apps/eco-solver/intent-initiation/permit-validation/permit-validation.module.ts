import { Module } from '@nestjs/common'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [TransactionModule],

  controllers: [],

  providers: [PermitValidationService],

  exports: [PermitValidationService],
})
export class PermitValidationModule {}
