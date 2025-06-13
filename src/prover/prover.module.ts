import { Module } from '@nestjs/common'
import { ProofService } from './proof.service'
import { ProverValidationService } from '@/prover/prover-validation.service'
import { TransactionModule } from '../transaction/transaction.module'

@Module({
  imports: [TransactionModule],
  providers: [ProofService, ProverValidationService],
  exports: [ProofService, ProverValidationService],
})
export class ProverModule {}
