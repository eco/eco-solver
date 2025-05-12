import { Module, Global } from '@nestjs/common'
import { JupiterPriceService } from './jupiter-price.service'
import { CacheModule } from '@nestjs/cache-manager'

@Global()
@Module({
  imports: [
    CacheModule.register({
      ttl: 10,
      max: 500,
    }),
  ],
  providers: [JupiterPriceService],
  exports: [JupiterPriceService],
})
export class PriceModule {}
