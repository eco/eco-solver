import { QuoteRewardDataType } from '@/quote/dto/quote.reward.data.dto'
import {
  QuoteRewardTokenDataModel,
  QuoteRewardTokenDataSchema,
} from '@/quote/schemas/quote-token.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { Hex } from 'viem'

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteRewardTokenDataModel)
  tokens: QuoteRewardTokenDataModel[]

  getQuoteRewardData?(): QuoteRewardDataType {
    return {
      creator: this.creator,
      prover: this.prover,
      deadline: this.deadline,
      nativeValue: this.nativeValue,
      tokens: this.tokens.map((token) => token.getRewardTokensInterface!()),
    }
  }
}

export const QuoteRewardDataSchema = SchemaFactory.createForClass(QuoteRewardDataModel)
QuoteRewardDataSchema.index({ prover: 1 }, { unique: false })
