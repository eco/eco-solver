import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'
import { RouteType, hashRoute, encodeRoute } from '@libs/shared/contracts'
import { TargetCallDataModel, TargetCallDataSchema } from './intent-call-data.schema'
import { TokenAmountDataModel, TokenAmountDataSchema } from './intent-token-amount.schema'

@Schema({ timestamps: true })
export class RouteDataModel implements RouteType {
  @Prop({ required: true, type: String })
  salt: Hex
  @Prop({ required: true, type: BigInt })
  source: bigint
  @Prop({ required: true, type: BigInt })
  destination: bigint
  @Prop({ required: true, type: String })
  inbox: Hex
  @Prop({ required: true, type: [TokenAmountDataSchema] })
  tokens: TokenAmountDataModel[]
  @Prop({ required: true, type: [TargetCallDataSchema] })
  calls: TargetCallDataModel[]

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
    this.inbox = inbox
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
