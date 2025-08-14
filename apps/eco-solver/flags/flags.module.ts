import { Module } from '@nestjs/common'
import { FlagService } from './flags.service'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [TransactionModule],
  providers: [FlagService],
  exports: [FlagService],
})
export class FlagsModule {}
