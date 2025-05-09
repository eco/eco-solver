import { BalanceModule } from '@/balance/balance.module'
import { FeeService } from '@/fee/fee.service'
import { Module } from '@nestjs/common'
import { SolanaFeeService } from './solanaFee.service'
import { PriceModule as SolanaJupiterPriceModule } from '@/solana/price/jupiter-price.module'

@Module({
  imports: [BalanceModule, SolanaJupiterPriceModule],
  providers: [FeeService, SolanaFeeService],
  exports: [FeeService, SolanaFeeService],
})
export class FeeModule {}
