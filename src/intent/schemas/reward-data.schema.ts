import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { VmType, Address } from '@/eco-configs/eco-config.types'
import { RewardType, encodeReward, hashReward } from '@/utils/encodeAndHash'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
@Schema({ timestamps: true })
export class RewardDataModel {
  @Prop({ required: true, type: String })
  vm: VmType

  @Prop({ required: true, type: String })
  creator: Address // Can be EVM hex or Solana base58

  @Prop({ required: true, type: String })
  prover: Address

  @Prop({ required: true, type: BigInt })
  deadline: bigint

  @Prop({ required: true, type: BigInt })
  nativeAmount: bigint

  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]

  constructor(
    vm: VmType,
    creator: Address,
    prover: Address,
    deadline: bigint,
    nativeAmount: bigint,
    tokens: TokenAmountDataModel[],
  ) {
    this.vm = vm
    this.creator = creator
    this.prover = prover
    this.deadline = deadline
    this.nativeAmount = nativeAmount
    this.tokens = tokens
  }

  // Type-safe helpers
  asEvmReward(): RewardType<VmType.EVM> {
    if (this.vm !== VmType.EVM) throw new Error('Not an EVM reward')
    return { ...this } as RewardType<VmType.EVM>
  }

  asSvmReward(): RewardType<VmType.SVM> {
    if (this.vm !== VmType.SVM) throw new Error('Not an SVM reward')
    return { ...this } as RewardType<VmType.SVM>
  }

  static getHash(rewardDataModel: RewardDataModel): Hex {
    // The library hashReward function handles VM switching internally
    return hashReward(rewardDataModel)
  }

  static encode(rewardDataModel: RewardDataModel): Hex {
    return encodeReward(rewardDataModel)
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
