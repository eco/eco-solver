import { Injectable } from '@nestjs/common'

export interface TokenConfig {
  address: string
  symbol: string
  name: string
  decimals: number
}

export interface TokenBalance {
  address: string
  balance: bigint
}

@Injectable()
export class BalanceService {
  async getAllTokenData(): Promise<Array<{
    config: TokenConfig
    balance: TokenBalance
    chainId: number
  }>> {
    // TODO: Implement balance fetching logic
    // This is a placeholder implementation
    return []
  }
}