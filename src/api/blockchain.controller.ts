import { BlockchainService } from '@/blockchain/blockchain.service'
import { API_V2_ROOT } from '@/common/routes/constants'
import { Controller, Get, Logger } from '@nestjs/common'

@Controller(API_V2_ROOT + '/blockchain')
export class BlockchainController {
  private logger = new Logger(BlockchainController.name)

  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('/chains')
  async getSupportedChainsAndTokens() {
    return this.blockchainService.getSupportedChainsAndTokens()
  }
}
