import { BalanceService } from '@/balance/balance.service'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { API_ROOT, BALANCE_ROUTE } from '@/common/routes/constants'
import { convertBigIntsToStrings } from '@/common/viem/utils'
import { CacheInterceptor } from '@nestjs/cache-manager'
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common'
import * as _ from 'lodash'

@Controller(API_ROOT + BALANCE_ROUTE)
@UseInterceptors(CacheInterceptor)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  async getBalances(@Query('flat') flat?: boolean) {
    const [tokenData, nativeData] = await Promise.all([
      this.balanceService.getAllTokenData(),
      this.balanceService.fetchAllNativeBalances(),
    ])

    const filteredNativeData = nativeData.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ) // Remove null entries

    if (flat) {
      return convertBigIntsToStrings({
        tokens: this.groupTokensByChain(tokenData),
        native: this.groupNativeByChain(filteredNativeData),
      })
    }

    return convertBigIntsToStrings({
      tokens: tokenData,
      native: filteredNativeData,
    })
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

  groupNativeByChain(
    data: {
      chainId: number
      balance: bigint
      blockNumber: bigint
    }[],
  ) {
    // Group native balances by chainId
    const grouped = _.groupBy(data, 'chainId')

    // For each chainId, return the native balance data
    return _.mapValues(
      grouped,
      (nativeBalances) =>
        nativeBalances.map((native) => ({
          balance: native.balance,
          blockNumber: native.blockNumber,
        }))[0], // Should only be one native balance per chain
    )
  }
}
