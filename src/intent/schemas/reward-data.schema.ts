import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { encodeReward, hashReward, RewardType } from '@eco-foundation/routes-ts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { ChainAddress } from '@/eco-configs/eco-config.types'

// MultiChainRewardType extends RewardType but overrides creator and prover to support multi-chain addresses
export interface MultiChainRewardType extends Omit<RewardType, 'creator' | 'prover' | 'tokens'> {
  creator: ChainAddress
  prover: ChainAddress
  tokens: {
    token: ChainAddress
    amount: bigint
  }[]
}

@Schema({ timestamps: true })
export class RewardDataModel {
  @Prop({ required: true, type: String })
  creator: ChainAddress
  @Prop({ required: true, type: String })
  prover: ChainAddress
  @Prop({ required: true, type: BigInt })
  deadline: bigint
  @Prop({ required: true, type: BigInt })
  nativeValue: bigint
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]

  constructor(
    creator: ChainAddress,
    prover: ChainAddress,
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

  static getHash(rewardDataModel: RewardDataModel) {
    return hashReward(intentDataModel)
  }

  static encode(intentDataModel: RewardDataModel) {
    return encodeReward(intentDataModel)
  }
}

export const RewardDataModelSchema = SchemaFactory.createForClass(RewardDataModel)
RewardDataModelSchema.index({ creator: 1 }, { unique: false })
RewardDataModelSchema.index({ prover: 1 }, { unique: false })
RewardDataModelSchema.index({ tokens: 1 }, { unique: false })

RewardDataModelSchema.methods.getHash = function (): Hex {
  return hashReward(this)
}

RewardDataModelSchema.methods.getEncoding = function (): Hex {
  return encodeReward(this)
}
