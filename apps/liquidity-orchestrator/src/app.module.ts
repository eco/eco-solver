import { Module } from '@nestjs/common'
import { LiquidityManagerModule } from './domain/liquidity-manager.module'
import { BalanceModule } from './domain/balance.module'
import { IntervalModule } from './application/interval.module'

@Module({
  imports: [
    LiquidityManagerModule,
    BalanceModule,
    IntervalModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
