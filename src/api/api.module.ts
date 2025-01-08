import { BalanceController } from '@/api/balance.controller'
import { BalanceModule } from '@/balance/balance.module'
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'

@Module({
  imports: [
    BalanceModule,
    CacheModule.register({
      ttl: 10, // seconds
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
