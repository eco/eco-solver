import { RewardViemType } from '@/contracts'
import { encodeReward } from '@/contracts/intent.viem'
import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex, keccak256 } from 'viem'

@Schema({ timestamps: true })
export class RewardDataModel implements RewardViemType {
  @Prop({ required: true, type: String })
  creator: Hex
  @Prop({ required: true, type: String })
  prover: Hex
  @Prop({ required: true, type: BigInt })
  deadline: bigint
  @Prop({ required: true, type: BigInt })
  nativeValue: bigint
  @Prop({ required: true, type: TokenAmountDataSchema })
  tokens: TokenAmountDataModel[]

  constructor(
    creator: Hex,
    prover: Hex,
    deadline: bigint,
    nativeValue: bigint,
    tokens: TokenAmountDataModel[],
  ) {
    this.creator = creator
    this.prover = prover
    this.deadline = deadline
    this.nativeValue = nativeValue
    this.tokens = tokens
  }

  getEncoding(): Hex {
    return encodeReward(this)
  }

  getHash(): Hex {
    return keccak256(this.getEncoding())
  }
}
export const RewardDataModelSchema = SchemaFactory.createForClass(RewardDataModel)
RewardDataModelSchema.index({ creator: 1 }, { unique: false })
RewardDataModelSchema.index({ prover: 1 }, { unique: false })
RewardDataModelSchema.index({ tokens: 1 }, { unique: false })
