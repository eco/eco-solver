import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '@/common/errors/eco-error'
import { getAddress, Hex, Mutable } from 'viem'
import { IntentCreatedEventLog, CallDataInterface, RewardTokensInterface } from '@/contracts'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { encodeIntent, hashIntent, IntentType } from '@eco-foundation/routes-ts'

@Schema({ timestamps: true })
export class IntentDataModel implements IntentType {
  @Prop({ required: true, type: String })
  hash: Hex
  @Prop({ required: true, type: RouteDataSchema })
  route: RouteDataModel
  @Prop({ required: true, type: RewardDataModelSchema })
  reward: RewardDataModel
  //log
  @Prop({ required: true })
  logIndex: number

  constructor(
    hash: Hex,
    salt: Hex,
    source: bigint,
    destination: bigint,
    inbox: Hex,
    routeTokens: RewardTokensInterface[],
    calls: CallDataInterface[],
    creator: Hex,
    prover: Hex,
    deadline: bigint,
    nativeValue: bigint,
    rewardTokens: RewardTokensInterface[],
    logIndex: number,
  ) {
    if (calls.length == 0 || rewardTokens.length == 0 || routeTokens.length == 0) {
      throw EcoError.IntentSourceDataInvalidParams
    }
    this.hash = hash

    this.route = new RouteDataModel(
      salt,
      source,
      destination,
      getAddress(inbox),
      routeTokens.map((token) => {
        token.token = getAddress(token.token)
        return token
      }),
      calls.map((call) => {
        call.target = getAddress(call.target)
        return call
      }),
    )

    this.reward = new RewardDataModel(
      getAddress(creator),
      getAddress(prover),
      deadline,
      nativeValue,
      rewardTokens.map((token) => {
        token.token = getAddress(token.token)
        return token
      }),
    )

    this.logIndex = logIndex
  }

  static getHash(intentDataModel: IntentDataModel) {
    return hashIntent(intentDataModel)
  }

  static encode(intentDataModel: IntentDataModel) {
    return encodeIntent(intentDataModel)
  }

  static fromEvent(event: IntentCreatedEventLog, logIndex: number): IntentDataModel {
    const e = event.args
    return new IntentDataModel(
      e.hash,
      e.salt,
      e.source,
      e.destination,
      e.inbox,
      e.routeTokens as Mutable<typeof e.routeTokens>,
      e.calls as Mutable<typeof e.calls>,
      e.creator,
      e.prover,
      e.deadline,
      e.nativeValue,
      e.rewardTokens as Mutable<typeof e.rewardTokens>,
      logIndex,
    )
  }
}

export const IntentSourceDataSchema = SchemaFactory.createForClass(IntentDataModel)
IntentSourceDataSchema.index({ hash: 1 }, { unique: true })
IntentSourceDataSchema.index(
  { source: 1, destination: 'ascending', deadline: 'ascending' },
  { unique: false },
)

IntentSourceDataSchema.methods.getHash = function (): {
  routeHash: Hex
  rewardHash: Hex
  intentHash: Hex
} {
  return hashIntent(this)
}

IntentSourceDataSchema.methods.getEncoding = function (): Hex {
  return encodeIntent(this)
}
