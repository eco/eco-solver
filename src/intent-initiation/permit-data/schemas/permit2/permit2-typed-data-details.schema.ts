import { Hex } from 'viem'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema({ _id: false })
export class Permit2TypedDataDetails {
  @Prop({ required: true })
  token: Hex

  @Prop({ required: true, type: BigInt })
  amount: bigint

  @Prop({ required: true })
  expiration: string // string of a UNIX seconds since epoch integer

  @Prop({ required: true })
  nonce: string // string of a bigint
}

export const Permit2TypedDataDetailsSchema = SchemaFactory.createForClass(Permit2TypedDataDetails)
