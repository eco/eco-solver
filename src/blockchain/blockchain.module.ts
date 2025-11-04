import { Module } from '@nestjs/common'
import { BlockchainService } from './blockchain.service'

@Module({
  imports: [],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
