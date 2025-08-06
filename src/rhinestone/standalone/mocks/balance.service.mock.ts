import { Injectable } from '@nestjs/common'
import { Hex } from 'viem'
import { TokenFetchAnalysis } from '@/balance/balance.service'
import { TokenBalance } from '@/balance/types'

@Injectable()
export class MockBalanceService {
  async getBalance(chainId: number, address: string, token?: string): Promise<bigint> {
    return BigInt(1000000000000000000) // 1 ETH
  }

  async hasBalance(
    chainId: number,
    address: string,
    amount: bigint,
    token?: string,
  ): Promise<boolean> {
    return true
  }

  async fetchTokenData(chainId: number): Promise<TokenFetchAnalysis[]> {
    return []
  }

  async fetchTokenBalances(chainId: number, tokens: string[]): Promise<Record<Hex, TokenBalance>> {
    const result: Record<Hex, TokenBalance> = {}
    for (const token of tokens) {
      result[token as Hex] = {
        address: token as Hex,
        balance: BigInt(1000000000000000000),
        decimals: 18,
      }
    }
    return result
  }
}
