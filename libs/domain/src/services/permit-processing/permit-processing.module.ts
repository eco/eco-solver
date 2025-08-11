@Module({
  imports: [],

  controllers: [],

  providers: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],

  exports: [PermitProcessor, PermitTxBuilder, Permit2Processor, Permit2TxBuilder],
})
export class PermitProcessingModule {}
