import { TargetCallDataModel, TargetCallDataSchema } from '@/intent/schemas/intent-call-data.schema'
import { encodeRoute, hashRoute, RouteType } from '@eco-foundation/routes-ts'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

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
  @Prop({ required: true, type: TargetCallDataSchema })
  calls: TargetCallDataModel[]

  constructor(
    salt: Hex,
    source: bigint,
    destination: bigint,
    inbox: Hex,
    calls: TargetCallDataModel[],
  ) {
    this.salt = salt
    this.source = source
    this.destination = destination
    this.inbox = inbox
    this.calls = calls
  }

  getEncoding(): Hex {
    return encodeRoute(this)
  }

  getHash(): Hex {
    return hashRoute(this)
  }
}

export const RouteDataSchema = SchemaFactory.createForClass(RouteDataModel)
RouteDataSchema.index({ source: 1 }, { unique: false })
RouteDataSchema.index({ destination: 1 }, { unique: false })
