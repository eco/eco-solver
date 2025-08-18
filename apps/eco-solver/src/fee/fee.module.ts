import { BalanceModule } from '@eco-solver/balance/balance.module'
import { FeeService } from '@eco-solver/fee/fee.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [BalanceModule],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
