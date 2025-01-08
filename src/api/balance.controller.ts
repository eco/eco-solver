import { BalanceService } from '@/balance/balance.service'
import { API_ROOT, BALANCE_ROUTE } from '@/common/routes/constants'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { Controller, Get, UseInterceptors } from '@nestjs/common'

@Controller(API_ROOT + BALANCE_ROUTE)
@UseInterceptors(CacheInterceptor)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  async getBalances(): Promise<any> {
    return convertBigIntsToStrings(await this.balanceService.getAllTokenData())
  }
}
