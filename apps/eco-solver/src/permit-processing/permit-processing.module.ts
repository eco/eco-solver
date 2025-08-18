import { Module } from '@nestjs/common'
import { Permit2Processor } from '@eco-solver/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@eco-solver/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@eco-solver/permit-processing/permit-processor'
import { PermitTxBuilder } from '@eco-solver/permit-processing/permit-tx-builder'

@Module({
  imports: [],

  controllers: [],

  providers: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],

  exports: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],
})
export class PermitProcessingModule {}
