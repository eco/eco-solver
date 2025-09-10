import {
  AllowanceOrTransferSchema,
  AllowanceOrTransfer,
} from '@/intent-initiation/permit-data/schemas/permit3/allowance-or-transfer.schema'
import { Hex } from 'viem'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

@Schema({ _id: false })
export class Permit3 {
  @Prop({ required: true })
  chainId: number

  @Prop({ required: true })
  permitContract: Hex

  @Prop({ required: true })
  owner: Hex

  @Prop({ required: true })
  salt: Hex

  @Prop({ required: true })
  signature: string

  @Prop({ required: true, type: BigInt })
  deadline: bigint // UNIX seconds since epoch integer

  @Prop({ required: true })
  timestamp: number

  @Prop({ type: [String], required: true })
  leafs: Hex[]

  @Prop({ type: [AllowanceOrTransferSchema], required: true })
  @ValidateNested()
  @Type(() => AllowanceOrTransfer)
  allowanceOrTransfers: AllowanceOrTransfer[]
}

export const Permit3Schema = SchemaFactory.createForClass(Permit3)
