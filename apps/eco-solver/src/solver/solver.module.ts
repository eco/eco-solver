import { Module } from '@nestjs/common'
import { ValidSmartWalletService } from './filters/valid-smart-wallet.service'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [TransactionModule],
  providers: [ValidSmartWalletService],
  exports: [ValidSmartWalletService],
})
export class SolverModule {}
