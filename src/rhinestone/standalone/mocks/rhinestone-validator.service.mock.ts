import { Injectable, Logger } from '@nestjs/common'
import { RhinestoneRelayerActionV1 } from '@/rhinestone/types/rhinestone-websocket.types'

@Injectable()
export class MockRhinestoneValidatorService {
  private readonly logger = new Logger(MockRhinestoneValidatorService.name)

  constructor() {
    this.logger.log('MockRhinestoneValidatorService initialized')
  }

  async validateRelayerAction(message: RhinestoneRelayerActionV1): Promise<void> {
    this.logger.log(`Mock validation for relayer action: ${message.id}`)
    // In mock mode, always pass validation
    return Promise.resolve()
  }

  async validateBundle(bundleMessage: any): Promise<void> {
    this.logger.log(`Mock validation for bundle: ${bundleMessage.bundleId}`)
    // In mock mode, always pass validation
    return Promise.resolve()
  }
}