import { Injectable } from '@nestjs/common'

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
}
