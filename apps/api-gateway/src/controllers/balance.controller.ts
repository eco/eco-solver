import { Controller, Get, Query, UseInterceptors } from '@nestjs/common'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { API_ROOT, BALANCE_ROUTE } from '@libs/shared'
import { BalanceService, TokenConfig, TokenBalance } from '@libs/domain'
import * as _ from 'lodash'
import { convertBigIntsToStrings } from '@libs/integrations'

@Controller(API_ROOT + BALANCE_ROUTE)
@UseInterceptors(CacheInterceptor)
export class BalanceController {
  constructor(
    private readonly balanceService: BalanceService
  ) {}

  @Get()
  async getBalances(@Query('flat') flat?: boolean) {
    const data = await this.balanceService.getAllTokenData()
    if (flat) {
      return convertBigIntsToStrings(this.groupTokensByChain(data))
    }
    return convertBigIntsToStrings(data)
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
