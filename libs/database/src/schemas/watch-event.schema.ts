@Schema()
export class WatchEventModel implements ViemEventLog {
  @Prop({ required: true, type: BigInt })
  sourceChainID: bigint

  @Prop({ required: true, type: String })
  sourceNetwork: Network

  @Prop({ required: true, type: BigInt })
  blockNumber: bigint

  @Prop({ required: true, type: String })
  blockHash: Hex

  @Prop({ required: true })
  transactionIndex: number

  @Prop({ required: true })
  removed: boolean

  @Prop({ required: true, type: String })
  address: Hex

  @Prop({ required: true, type: String })
  data: Hex

  @Prop({ required: true })
  topics: [] | [Hex, ...Hex[]]

  @Prop({ required: true, type: String })
  transactionHash: Hex

  @Prop({ required: true })
  logIndex: number
}
export const WatchEventSchema = SchemaFactory.createForClass(WatchEventModel)
WatchEventSchema.index({ sourceChainID: 1 }, { unique: false })
WatchEventSchema.index({ transactionHash: 1 }, { unique: true })
