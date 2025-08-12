import { BalanceController } from '@/api/balance.controller'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { QuoteController } from '@/api/quote.controller'
import { TestWatchIntentController } from '@/api/test-watch-intent.controller'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { QuoteModule } from '@/quote/quote.module'
import { WatchModule } from '@/watch/watch.module'
import { TokenDecimalsInterceptor } from '@/interceptors/token-decimals.interceptor'
import { TokenCallsInterceptor } from '@/interceptors/token-calls.interceptor'
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
    WatchModule,
  ],
  controllers: [
    BalanceController,
    QuoteController,
    IntentInitiationController,
    TestWatchIntentController,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    TokenDecimalsInterceptor,
    TokenCallsInterceptor,
  ],
})
export class ApiModule {}
