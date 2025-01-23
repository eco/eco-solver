import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '@/common/errors/eco-error'
import { getAddress, Hex, keccak256, Mutable } from 'viem'
import {
  IntentCreatedEventLog,
  IntentViewType,
  TargetCallViemType,
  TokenAmountViemType,
} from '@/contracts'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { encodeIntent } from '@/contracts/intent.viem'

@Schema({ timestamps: true })
export class IntentDataModel implements IntentViewType {
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
    calls: TargetCallViemType[],
    creator: Hex,
    prover: Hex,
    deadline: bigint,
    nativeValue: bigint,
    tokens: TokenAmountViemType[],
    logIndex: number,
  ) {
    if (calls.length == 0 || tokens.length == 0) {
      throw EcoError.IntentSourceDataInvalidParams
    }
    this.hash = hash

    this.route = new RouteDataModel(
      salt,
      source,
      destination,
      getAddress(inbox),
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
      tokens.map((token) => {
        token.token = getAddress(token.token)
        return token
      }),
    )

    this.logIndex = logIndex
  }

  getEncoding(): Hex {
    return encodeIntent(this)
  }

  getHash(): {
    routeHash: Hex
    rewardHash: Hex
    intentHash: Hex
  } {
    return {
      intentHash: keccak256(this.getEncoding()),
      routeHash: this.route.getHash(),
      rewardHash: this.reward.getHash(),
    }
  }

  static fromEvent(event: IntentCreatedEventLog, logIndex: number): IntentDataModel {
    const e = event.args
    return new IntentDataModel(
      e.hash,
      e.salt,
      e.source,
      e.destination,
      e.inbox,
      e.calls as Mutable<typeof e.calls>,
      e.creator,
      e.prover,
      e.deadline,
      e.nativeValue,
      e.tokens as Mutable<typeof e.tokens>,
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
