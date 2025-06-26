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
export class PermitData {
  @Prop({ required: true })
  intentGroupID: string

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

export const PermitDataSchema = SchemaFactory.createForClass(PermitData)

// Define indexes.
PermitDataSchema.index({ intentGroupID: 1 }, { unique: true })
PermitDataSchema.index({ createdAt: 1 }, { unique: false })
PermitDataSchema.index({ updatedAt: 1 }, { unique: false })
