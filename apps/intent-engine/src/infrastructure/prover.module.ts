import { Module } from '@nestjs/common'
import { ProofService } from './proof.service'

// TODO: Import TransactionModule from the correct library once it's available
// import { TransactionModule } from '@libs/...'

@Module({
  imports: [
    // TransactionModule,
  ],
  providers: [ProofService],
  exports: [ProofService],
})
export class ProverModule {}
