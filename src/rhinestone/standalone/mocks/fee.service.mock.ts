import { Injectable } from '@nestjs/common'

@Injectable()
export class MockFeeService {
  async calculateFee(params: any): Promise<any> {
    return {
      fee: BigInt(0),
      gasCost: BigInt(0),
    }
  }

  async getGasPrice(chainId: number): Promise<bigint> {
    return BigInt(1000000000) // 1 gwei
  }
}
