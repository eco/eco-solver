import { Injectable, Logger } from '@nestjs/common'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'

@Injectable()
export class MockFeeService {
  private readonly logger = new Logger(MockFeeService.name)

  onModuleInit() {
    // Mock implementation - no initialization needed
  }

  async calculateFee(_params: any): Promise<any> {
    return {
      fee: BigInt(0),
      gasCost: BigInt(0),
    }
  }

  async getGasPrice(_chainId: number): Promise<bigint> {
    return BigInt(1000000000) // 1 gwei
  }

  /**
   * Mock isRouteFeasible - always returns feasible for testing
   * @param quote The quote/intent to check feasibility for
   * @returns Always returns no error (feasible) in mock
   */
  async isRouteFeasible(_quote: QuoteIntentDataInterface): Promise<{ error?: Error }> {
    this.logger.log(`Mock isRouteFeasible called for intent`)
    // Always return feasible in mock mode
    return { error: undefined }
  }

  async getTotalFill(_quote: QuoteIntentDataInterface, _useRouteTokens = false): Promise<any> {
    return {
      totalFillNormalized: { token: 0n, native: 0n },
      error: undefined,
    }
  }

  async getTotalRewards(_quote: QuoteIntentDataInterface): Promise<any> {
    return {
      totalRewardsNormalized: { token: 0n, native: 0n },
      error: undefined,
    }
  }

  getFeeConfig(_args?: any): any {
    return {
      algorithm: 'linear',
      limit: {
        tokenBase6: 1000000n,
        nativeBase18: 1000000000000000000n,
      },
      constants: {
        token: {
          baseFee: 20000,
          tranche: {
            unitSize: 100000000,
            unitFee: 15000,
          },
        },
        native: {
          baseFee: 20000,
          tranche: {
            unitSize: 100000000,
            unitFee: 15000,
          },
        },
      },
    }
  }
}
