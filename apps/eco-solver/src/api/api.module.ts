import { BalanceController } from '@eco-solver/api/balance.controller'
import { IntentInitiationController } from '@eco-solver/api/intent-initiation.controller'
import { QuoteController } from '@eco-solver/api/quote.controller'
import { BalanceModule } from '@eco-solver/balance/balance.module'
import { EcoConfigService } from '@libs/config-core'
import { QuoteModule } from '@eco-solver/quote/quote.module'
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'

@Module({
  imports: [
    BalanceModule,
    CacheModule.registerAsync({
      useFactory: async (configService: EcoConfigService) => configService.getCache(),
      inject: [EcoConfigService],
    }),
    QuoteModule,
  ],
  controllers: [BalanceController, QuoteController, IntentInitiationController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class ApiModule {}
