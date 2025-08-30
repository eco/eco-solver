import { APP_INTERCEPTOR } from '@nestjs/core'
import { BalanceController } from '@/api/balance.controller'
import { BalanceModule } from '@/balance/balance.module'
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { Module } from '@nestjs/common'
import { QuoteController } from '@/api/quote.controller'
import { QuoteModule } from '@/quote/quote.module'
import { QuoteV2Controller } from '@/api/quote-v2.controller'

@Module({
  imports: [
    BalanceModule,
    CacheModule.registerAsync({
      useFactory: async (configService: EcoConfigService) => configService.getCache(),
      inject: [EcoConfigService],
    }),
    QuoteModule,
  ],
  controllers: [BalanceController, QuoteController, QuoteV2Controller, IntentInitiationController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class ApiModule {}
