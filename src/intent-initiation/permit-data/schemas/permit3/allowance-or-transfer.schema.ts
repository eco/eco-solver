import { Hex } from 'viem'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema({ _id: false })
export class AllowanceOrTransfer {
  @Prop({ required: true })
  chainID: number // The original chain ID from the signature

  @Prop({ required: true })
  modeOrExpiration: number

  @Prop({ required: true })
  token: Hex

  @Prop({ required: true })
  account: Hex

  @Prop({ required: true, type: BigInt })
  amountDelta: bigint
}

export const AllowanceOrTransferSchema = SchemaFactory.createForClass(AllowanceOrTransfer)
