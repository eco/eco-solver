import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { QuoteRewardDataType } from '../schemas/quote-intent.schema'
import {
  QuoteRewardTokenDataModel,
  QuoteRewardTokenDataSchema,
} from './quote-token.schema'

@Schema({ timestamps: true })
export class QuoteRewardDataModel implements QuoteRewardDataType {
  @Prop({ required: true, type: String })
  creator: Hex
  @Prop({ required: true, type: String })
  prover: Hex
  @Prop({ required: true, type: BigInt })
  deadline: bigint
  @Prop({ required: true, type: BigInt })
  nativeValue: bigint
  @Prop({ required: true, type: [QuoteRewardTokenDataSchema] })
  tokens: QuoteRewardTokenDataModel[]
}

export const QuoteRewardDataSchema = SchemaFactory.createForClass(QuoteRewardDataModel)
QuoteRewardDataSchema.index({ prover: 1 }, { unique: false })
