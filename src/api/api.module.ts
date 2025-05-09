import { BalanceController } from '@/api/balance.controller'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { QuoteController } from '@/api/quote.controller'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { QuoteModule } from '@/quote/quote.module'
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { IntentInitiationModule } from '@/intent-initiation/intent-initiation.module'

@Module({
  imports: [
    BalanceModule,
    CacheModule.registerAsync({
      useFactory: async (configService: EcoConfigService) => configService.getCache(),
      inject: [EcoConfigService],
    }),
    QuoteModule,
    IntentInitiationModule,
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
