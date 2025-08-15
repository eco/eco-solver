import { BalanceController } from '@/api/balance.controller'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { QuoteController } from '@/api/quote.controller'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigService } from '@eco/infrastructure-config'
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
  controllers: [BalanceController, QuoteController, IntentInitiationController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class ApiModule {}
