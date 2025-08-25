import { QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import {
  QuoteRewardTokenDataModel,
  QuoteRewardTokenDataSchema,
} from '@/quote/schemas/quote-token.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { BigIntSchemaType } from '@/common/schemas/bigint-schema.type'

@Schema({ timestamps: true })
export class QuoteRewardDataModel implements QuoteRewardDataType {
  @Prop({ required: true, type: String })
  creator: Hex
  @Prop({ required: true, type: String })
  prover: Hex
  @Prop({ required: true, type: BigIntSchemaType })
  deadline: bigint
  @Prop({ required: true, type: BigIntSchemaType })
  nativeValue: bigint
  @Prop({ required: true, type: [QuoteRewardTokenDataSchema] })
  tokens: QuoteRewardTokenDataModel[]
}

export const QuoteRewardDataSchema = SchemaFactory.createForClass(QuoteRewardDataModel)
QuoteRewardDataSchema.index({ prover: 1 }, { unique: false })
