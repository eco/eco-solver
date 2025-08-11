import { Module } from '@nestjs/common'
import { CacheModule, CacheInterceptor } from '@nestjs/cache-manager'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { FeeModule } from '@libs/domain'
import { EcoConfigService } from '@libs/integrations'
import { BalanceController } from './balance.controller'
import { QuoteController } from './quote.controller'
import { IntentInitiationController } from './intent-initiation.controller'

@Module({
  imports: [
    FeeModule,
    CacheModule.registerAsync({
      useFactory: async (configService: EcoConfigService) => configService.getCache(),
      inject: [EcoConfigService],
    }),
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
