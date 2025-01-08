import { BalanceController } from '@/api/balance.controller'
import { BalanceModule } from '@/balance/balance.module'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
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
  ],
  controllers: [BalanceController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class ApiModule {}
