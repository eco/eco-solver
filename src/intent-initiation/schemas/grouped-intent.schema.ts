import { Hex } from 'viem'
import {
  Permit2,
  Permit2Schema,
} from '@/intent-initiation/permit-data/schemas/permit2/permit2.schema'
import {
  Permit3Schema,
  Permit3,
} from '@/intent-initiation/permit-data/schemas/permit3/permit3.schema'
import { PermitSchema, Permit } from '@/intent-initiation/permit-data/schemas/permit/permit.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

@Schema({ timestamps: true })
export class GroupedIntent {
  @Prop({ required: true })
  intentGroupID: string

  @Prop({ required: false })
  destinationChainID?: number

  @Prop({ required: false })
  destinationChainTxHash?: Hex

  @Prop({ type: [PermitSchema], required: false })
  @ValidateNested()
  @Type(() => Permit)
  permit?: Permit[]

  @Prop({ type: [Permit2Schema], required: false })
  @ValidateNested()
  @Type(() => Permit2)
  permit2?: Permit2[]

  @Prop({ type: Permit3Schema, required: false })
  @ValidateNested()
  @Type(() => Permit3)
  permit3?: Permit3

  @Prop({ required: false })
  createdAt?: Date

  @Prop({ required: false })
  updatedAt?: Date
}

export const GroupedIntentSchema = SchemaFactory.createForClass(GroupedIntent)

// Define indexes.
GroupedIntentSchema.index({ intentGroupID: 1 }, { unique: true })
GroupedIntentSchema.index({ destinationChainID: 1 }, { unique: false })
GroupedIntentSchema.index({ destinationChainTxHash: 1 }, { unique: false })
GroupedIntentSchema.index({ createdAt: 1 }, { unique: false })
GroupedIntentSchema.index({ updatedAt: 1 }, { unique: false })
