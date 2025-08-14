import { Module } from '@nestjs/common'
import { Permit2Processor } from '@/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@/permit-processing/permit-processor'
import { PermitTxBuilder } from '@/permit-processing/permit-tx-builder'

@Module({
  imports: [],

  controllers: [],

  providers: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],

  exports: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],
})
export class PermitProcessingModule {}
