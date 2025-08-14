import { BalanceModule } from '@/balance/balance.module'
import { FeeService } from '@/fee/fee.service'
import { Module } from '@nestjs/common'

@Module({
  imports: [BalanceModule],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
