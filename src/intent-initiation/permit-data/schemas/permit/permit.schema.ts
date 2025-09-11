import { Hex } from 'viem'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema({ _id: false })
export class Permit {
  @Prop({ required: true })
  chainID: number

  @Prop({ required: true })
  funder: Hex

  @Prop({ required: true })
  spender: Hex

  @Prop({ required: true })
  token: Hex // permit supported ERC20 to call 'permit' on, also the reward token to match up with

  @Prop({ required: true })
  signature: Hex

  @Prop({ required: true, type: BigInt })
  deadline: bigint // UNIX seconds since epoch integer

  @Prop({ required: true, type: BigInt })
  value: bigint
}

export const PermitSchema = SchemaFactory.createForClass(Permit)
