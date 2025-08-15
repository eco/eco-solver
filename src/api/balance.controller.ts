import { BalanceService } from '@/balance/balance.service'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { API_ROOT, BALANCE_ROUTE } from '@/common/routes/constants'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { recursiveConfigDenormalizer } from '@/eco-configs/utils'
import { deconvertNormScalar } from '@/fee/utils'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common'
import * as _ from 'lodash'

@Controller(API_ROOT + BALANCE_ROUTE)
@UseInterceptors(CacheInterceptor)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  async getBalances(@Query('flat') flat?: boolean) {
    const data = recursiveConfigDenormalizer(await this.balanceService.getAllTokenData())
    const deconvertedData = data.map((item) => ({
      ...item,
      balance: {
        ...item.balance,
        balance: deconvertNormScalar(item.balance.balance, item.balance.decimals.original),
      },
    }))
    if (flat) {
      return convertBigIntsToStrings(this.groupTokensByChain(deconvertedData))
    }
    return convertBigIntsToStrings(deconvertedData)
  }

  groupTokensByChain(
    data: {
      config: TokenConfig
      balance: TokenBalance
      chainId: number
    }[],
  ) {
    // Group tokens by the chainId property.
    const grouped = _.groupBy(data, 'chainId')

    // For each chainId group, map the tokens to only include token address and balance.
    return _.mapValues(grouped, (tokens) =>
      tokens.map((token) => ({
        address: token.balance.address,
        balance: token.balance.balance,
      })),
    )
  }
}
