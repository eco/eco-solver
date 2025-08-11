import { Injectable, Logger } from '@nestjs/common'
import { RhinestoneRelayerActionV1 } from '@/rhinestone/types/rhinestone-websocket.types'

@Injectable()
export class MockRhinestoneValidatorService {
  private readonly logger = new Logger(MockRhinestoneValidatorService.name)

  constructor() {
    this.logger.log('MockRhinestoneValidatorService initialized')
  }

  async validateRelayerAction(message: RhinestoneRelayerActionV1): Promise<{
    fill: any
    claimFillDatas: Array<{ intent: any; fillData: any }>
  }> {
    this.logger.log(`Mock validation for relayer action: ${message.id}`)
    
    // In mock mode, return a mock structure that matches the real service
    const mockIntent = {
      route: {
        source: 1,
        destination: 10,
        tokenIn: '0x0000000000000000000000000000000000000000',
        tokenOut: '0x0000000000000000000000000000000000000000',
        amountIn: '1000000000000000000',
        amountOut: '1000000000000000000',
        sender: '0x0000000000000000000000000000000000000001',
        receiver: '0x0000000000000000000000000000000000000002',
        commands: [],
        timeoutTimestamp: Math.floor(Date.now() / 1000) + 3600,
      },
      reward: {
        token: '0x0000000000000000000000000000000000000000',
        amount: '1000000000000000',
        beneficiary: '0x0000000000000000000000000000000000000003',
      },
    }

    const mockFillData = {
      order: {
        targetChainId: 10,
      },
      claimHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }

    // Return one claim fill data per claim in the message
    const claimFillDatas = message.claims.map(() => ({
      intent: mockIntent,
      fillData: mockFillData,
    }))

    return Promise.resolve({
      fill: { route: mockIntent.route, rewardHash: '0x0000000000000000000000000000000000000000000000000000000000000000' },
      claimFillDatas,
    })
  }

  async validateBundle(bundleMessage: any): Promise<void> {
    this.logger.log(`Mock validation for bundle: ${bundleMessage.bundleId}`)
    // In mock mode, always pass validation
    return Promise.resolve()
  }
}
