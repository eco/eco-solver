import { Module } from '@nestjs/common'
import { PermitValidationService } from './permit-validation.service'

// TODO: Import TransactionModule from the correct library once it's available
// import { TransactionModule } from '@libs/...'

@Module({
  imports: [
    // TransactionModule,
  ],

  controllers: [],

  providers: [PermitValidationService],

  exports: [PermitValidationService],
})
export class PermitValidationModule {}
