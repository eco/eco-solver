import { Hex } from 'viem'
import {
  Permit2TypedDataDetails,
  Permit2TypedDataDetailsSchema,
} from '@/intent-initiation/permit-data/schemas/permit2/permit2-typed-data-details.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

@Schema({ _id: false })
export class Permit2 {
  @Prop({ required: true })
  chainID: number

  @Prop({ required: true })
  permitContract: Hex

  @Prop({ type: [Permit2TypedDataDetailsSchema], required: true })
  @ValidateNested()
  @Type(() => Permit2TypedDataDetails)
  details: Permit2TypedDataDetails[]

  @Prop({ required: true })
  funder: Hex

  @Prop({ required: true })
  spender: Hex

  @Prop({ required: true, type: BigInt })
  sigDeadline: bigint // UNIX seconds since epoch integer

  @Prop({ required: true })
  signature: Hex
}

export const Permit2Schema = SchemaFactory.createForClass(Permit2)
