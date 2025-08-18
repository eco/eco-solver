import { Module } from '@nestjs/common'
import { PermitValidationService } from '@eco-solver/intent-initiation/permit-validation/permit-validation.service'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'

@Module({
  imports: [TransactionModule],

  controllers: [],

  providers: [PermitValidationService],

  exports: [PermitValidationService],
})
export class PermitValidationModule {}
