import { BalanceController } from '@/api/balance.controller'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { QuoteController } from '@/api/quote.controller'
import { QuoteV2Controller } from '@/api/quote-v2.controller'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { QuoteModule } from '@/quote/quote.module'
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
  controllers: [BalanceController, QuoteController, QuoteV2Controller, IntentInitiationController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class ApiModule {}
