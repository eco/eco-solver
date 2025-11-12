import { V2RouteType } from '@/contracts'
import { TargetCallDataModel, TargetCallDataSchema } from '@/intent/schemas/intent-call-data.schema'
import {
  TokenAmountDataModel,
  TokenAmountDataSchema,
} from '@/intent/schemas/intent-token-amount.schema'
import { encodeRoute, hashRoute } from '@eco-foundation/routes-ts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

export interface CreateRouteDataModelParams {
  salt: Hex
  source: bigint
  destination: bigint
  inbox: Hex
  routeTokens: TokenAmountDataModel[]
  calls: TargetCallDataModel[]
  deadline: bigint
  portal: Hex
  nativeAmount: bigint
}

@Schema({ timestamps: true })
export class RouteDataModel implements V2RouteType {
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

  @Prop({ required: true, type: BigInt })
  deadline: bigint

  @Prop({ required: true, type: String })
  portal: Hex

  @Prop({ required: true, type: BigInt })
  nativeAmount: bigint

  constructor(params: CreateRouteDataModelParams) {
    const { salt, source, destination, inbox, routeTokens, calls, deadline, portal, nativeAmount } =
      params

    this.salt = salt
    this.source = source
    this.destination = destination
    this.tokens = routeTokens
    this.inbox = inbox
    this.calls = calls
    this.deadline = deadline
    this.portal = portal
    this.nativeAmount = nativeAmount
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
