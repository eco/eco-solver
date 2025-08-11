import { Module } from '@nestjs/common'
import { FeeService } from './fee.service'

// BalanceModule import needs to be resolved
// import { BalanceModule } from '@libs/integrations' // or appropriate path

@Module({
  // imports: [BalanceModule], // TODO: Fix import path
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
