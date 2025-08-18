import { Module } from '@nestjs/common'
import { ProofService } from './proof.service'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [TransactionModule],
  providers: [ProofService],
  exports: [ProofService],
})
export class ProverModule {}
