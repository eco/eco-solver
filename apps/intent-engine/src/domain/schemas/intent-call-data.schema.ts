@Schema({ timestamps: true })
export class TargetCallDataModel implements CallDataInterface {
  @Prop({ required: true, type: String })
  target: Hex
  @Prop({ required: true, type: String })
  data: Hex
  @Prop({ required: true, type: BigInt })
  value: bigint
}

export const TargetCallDataSchema = SchemaFactory.createForClass(TargetCallDataModel)
TargetCallDataSchema.index({ target: 1 }, { unique: false })
