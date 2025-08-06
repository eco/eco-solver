import { TargetCallDataModel, TargetCallDataSchema } from '@/intent/schemas/intent-call-data.schema'
import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { encodeRoute, hashRoute, RouteType, VmType } from '@eco-foundation/routes-ts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { Address } from '@eco-foundation/routes-ts'

@Schema({ timestamps: true })
export class RouteDataModel {
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
    salt: Hex,
    source: bigint,
    destination: bigint,
    inbox: Hex,
    routeTokens: TokenAmountDataModel[],
    calls: TargetCallDataModel[],
  ) {
    this.salt = salt
    this.source = source
    this.destination = destination
    this.tokens = routeTokens
    this.portal = inbox
    this.calls = calls
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
