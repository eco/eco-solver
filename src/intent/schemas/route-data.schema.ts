import { TargetCallDataModel, TargetCallDataSchema } from '@/intent/schemas/intent-call-data.schema'
import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { RouteType, encodeRoute, hashRoute } from '@/utils/encodeAndHash'
import { VmType } from '@/eco-configs/eco-config.types'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { Address } from '@/eco-configs/eco-config.types'
import { web3 } from '@coral-xyz/anchor'

@Schema({ timestamps: true })
export class RouteDataModel implements RouteType {
  @Prop({ required: true, type: String })
  vm: VmType

  @Prop({ required: true, type: String })
  salt: Hex
  @Prop({ required: true, type: BigInt })
  source: bigint
  @Prop({ required: true, type: BigInt })
  destination: bigint
  @Prop({ required: true, type: String })
  portal: Address
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]
  @Prop({ required: true, type: [TargetCallDataSchema] })
  calls: TargetCallDataModel[]

  @Prop({ required: true, type: BigInt })
  deadline: bigint

  constructor(
    vm: VmType,
    salt: Hex,
    deadline: bigint,
    source: bigint,
    destination: bigint,
    portal: Address,
    routeTokens: TokenAmountDataModel[],
    calls: TargetCallDataModel[],
  ) {
    this.vm = vm
    this.salt = salt
    this.deadline = deadline
    this.destination = destination
    this.source = source

    this.tokens = routeTokens
    this.portal = portal
    this.calls = calls
  }

  static toSvmRoute(route: RouteType): RouteType<VmType.SVM> {
    return {
      vm: VmType.SVM,
      salt: route.salt,
      deadline: route.deadline,
      portal: new web3.PublicKey(route.portal),
      tokens: route.tokens.map((token) => ({
        token: new web3.PublicKey(token.token),
        amount: token.amount,
      })),
      calls: route.calls.map((call) => ({
        target: new web3.PublicKey(call.target),
        data: call.data,
        value: call.value,
      })),
    }
  }
}

export const RouteDataSchema = SchemaFactory.createForClass(RouteDataModel)
RouteDataSchema.index({ source: 1 }, { unique: false })
RouteDataSchema.index({ destination: 1 }, { unique: false })

RouteDataSchema.methods.getHash = function (): Hex {
  return hashRoute(this)
}

RouteDataSchema.methods.getEncoding = function (): Hex {
  return encodeRoute(this)
}
