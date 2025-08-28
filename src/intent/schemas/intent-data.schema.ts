import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '@/common/errors/eco-error'
import { getAddress, Hex, Mutable } from 'viem'
import {
  IntentCreatedEventLog,
  CallDataInterface,
  RewardTokensInterface,
  V2RouteType,
  V2IntentType,
} from '@/contracts'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { encodeIntent, hashIntent } from '@/utils/encodeAndHash'

export interface CreateIntentDataModelParams {
  quoteID?: string
  hash: Hex
  salt: Hex
  source: bigint
  destination: bigint
  inbox: Hex
  routeTokens: RewardTokensInterface[]
  calls: CallDataInterface[]
  creator: Hex
  prover: Hex
  executionDeadline: bigint
  claimDeadline: bigint
  nativeValue: bigint
  rewardTokens: RewardTokensInterface[]
  logIndex: number
  funder?: Hex
}

@Schema({ timestamps: true })
export class IntentDataModel implements V2IntentType {
  @Prop({ required: false, type: String })
  quoteID?: string

  @Prop({ required: true, type: String })
  hash: Hex

  @Prop({ required: true, type: RouteDataSchema })
  route: RouteDataModel

  @Prop({ required: true, type: RewardDataModelSchema })
  reward: RewardDataModel & { nativeAmount: bigint }

  //log
  @Prop({ required: true })
  logIndex: number

  @Prop({ required: false })
  funder?: Hex

  @Prop({ required: true, type: BigInt })
  destination: bigint

  @Prop({ required: true, type: BigInt })
  source: bigint

  // Getter to provide nativeAmount for V2IntentType compatibility
  get rewardWithNativeAmount() {
    return {
      ...this.reward,
      nativeAmount: this.reward.nativeValue,
    }
  }

  constructor(params: CreateIntentDataModelParams) {
    const {
      quoteID,
      hash,
      salt,
      source,
      destination,
      inbox,
      routeTokens,
      calls,
      creator,
      prover,
      executionDeadline,
      claimDeadline,
      nativeValue,
      rewardTokens,
      logIndex,
      funder,
    } = params

    if (calls.length == 0) {
      throw EcoError.IntentSourceDataInvalidParams
    }

    if (
      (rewardTokens.length == 0 || routeTokens.length == 0) &&
      !IntentDataModel.isNativeIntent(params)
    ) {
      throw EcoError.IntentSourceDataInvalidParams
    }

    this.quoteID = quoteID
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
      executionDeadline,
      inbox,
      nativeValue,
    )

    const reward = new RewardDataModel(
      getAddress(creator),
      getAddress(prover),
      claimDeadline,
      nativeValue,
      rewardTokens.map((token) => {
        token.token = getAddress(token.token)
        return token
      }),
    )

    this.reward = {
      ...reward,
      nativeAmount: nativeValue,
    }

    this.logIndex = logIndex
    this.funder = funder
  }

  static isNativeIntent(params: CreateIntentDataModelParams): boolean {
    return (
      params.calls.some((call) => {
        return call.value > 0
      }) || params.nativeValue > 0
    )
  }

  static getHash(intentDataModel: IntentDataModel) {
    return hashIntent(intentDataModel.route.destination, intentDataModel.route, intentDataModel.reward)
  }

  static encode(intentDataModel: IntentDataModel) {
    return encodeIntent(intentDataModel.route.destination, intentDataModel.route, intentDataModel.reward)
  }

  static fromEvent(
    sourceChainID: bigint,
    logIndex: number,
    event: IntentCreatedEventLog,
    route: Omit<V2RouteType, 'destination' | 'source'>,
  ): IntentDataModel {
    const e = event.args
    return new IntentDataModel({
      hash: e.intentHash,
      salt: route.salt,
      source: sourceChainID,
      destination: e.destination,
      inbox: route.portal,
      routeTokens: route.tokens as Mutable<typeof route.tokens>,
      calls: route.calls as Mutable<typeof route.calls>,
      creator: e.creator,
      prover: e.prover,
      executionDeadline: route.deadline,
      claimDeadline: e.rewardDeadline,
      nativeValue: e.rewardNativeAmount,
      rewardTokens: e.rewardTokens as Mutable<typeof e.rewardTokens>,
      logIndex,
    })
  }

  static toChainIntent(intent: IntentDataModel): V2IntentType {
    return {
      destination: intent.route.destination,
      route: {
        salt: intent.route.salt,
        deadline: intent.route.deadline,
        portal: intent.route.portal,
        nativeAmount: intent.route.nativeAmount,
        tokens: intent.route.tokens.map((token) => ({
          token: token.token,
          amount: token.amount,
        })),
        calls: intent.route.calls.map((call) => ({
          target: call.target,
          data: call.data,
          value: call.value,
        })),
      },
      reward: {
        deadline: intent.reward.deadline,
        creator: intent.reward.creator,
        prover: intent.reward.prover,
        nativeAmount: intent.reward.nativeValue,
        tokens: intent.reward.tokens.map((token) => ({
          token: token.token,
          amount: token.amount,
        })),
      },
    }
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
  return hashIntent(this.route.destination, this.route, this.reward)
}

IntentSourceDataSchema.methods.getEncoding = function (): Hex {
  return encodeIntent(this.route.destination, this.route, this.reward)
}
