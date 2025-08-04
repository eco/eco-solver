import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { encodeReward, hashReward, RewardType, VmType, Address } from '@eco-foundation/routes-ts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { ChainAddress } from '@/eco-configs/eco-config.types'
@Schema({ timestamps: true })
export class RewardDataModel<TVM extends VmType = VmType> implements RewardType<TVM> {
  @Prop({ required: true, type: String })
  vm: TVM
  @Prop({ required: true, type: String })
  creator: Address<TVM>
  @Prop({ required: true, type: String })
  prover: Address<TVM>
  @Prop({ required: true, type: BigInt })
  deadline: bigint
  @Prop({ required: true, type: BigInt })
  nativeAmount: bigint
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: readonly {
    token: Address<TVM>
    amount: bigint
  }[]

  constructor(
    vm: TVM,
    creator: Address<TVM>,
    prover: Address<TVM>,
    deadline: bigint,
    nativeAmount: bigint,
    tokens: readonly { token: Address<TVM>; amount: bigint }[],
  ) {
    this.vm = vm
    this.creator = creator
    this.prover = prover
    this.deadline = deadline
    this.nativeAmount = nativeAmount
    this.tokens = tokens
  }

  static getHash<TVM extends VmType>(vm: TVM, rewardDataModel: RewardDataModel<TVM>) {
    return hashReward(rewardDataModel)
  }

  static encode<TVM extends VmType>(rewardDataModel: RewardDataModel<TVM>) {
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
