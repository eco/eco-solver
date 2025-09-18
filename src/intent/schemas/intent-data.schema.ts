import { EcoError } from '@/common/errors/eco-error'
import { encodeIntent, hashIntent, IntentType } from '@eco-foundation/routes-ts'
import { getAddress, Hex, Mutable } from 'viem'
import {
  IntentCreatedEventLog,
  CallDataInterface,
  RewardTokensInterface,
  V2RouteType,
} from '@/contracts'
import { IntentV2 } from '@/contracts/v2-abi/Portal'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'

export interface CreateIntentDataModelParams {
  intentGroupID?: string
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
  deadline: bigint
  routeDeadline: bigint
  nativeValue: bigint
  rewardTokens: RewardTokensInterface[]
  logIndex: number
  funder?: Hex
}

@Schema({ timestamps: true })
export class IntentDataModel implements IntentType {
  @Prop({ required: false, type: String })
  intentGroupID?: string

  @Prop({ required: false, type: String })
  quoteID?: string

  @Prop({ required: true, type: String })
  hash: Hex

  @Prop({ required: true, type: RouteDataSchema })
  route: RouteDataModel

  @Prop({ required: true, type: RewardDataModelSchema })
  reward: RewardDataModel

  //log
  @Prop({ required: true })
  logIndex: number

  @Prop({ required: false })
  funder?: Hex

  constructor(params: CreateIntentDataModelParams) {
    const {
      intentGroupID,
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
      deadline,
      routeDeadline,
      nativeValue,
      rewardTokens,
      logIndex,
      funder,
    } = params

    if (calls.length == 0) {
      throw EcoError.IntentSourceDataInvalidParams
    }

    const isMissingTokens = rewardTokens.length === 0 || routeTokens.length === 0
    const isNotNativeIntent = !IntentDataModel.isNativeIntent(params)

    if (isMissingTokens && isNotNativeIntent) {
      throw EcoError.IntentSourceDataInvalidParams
    }

    this.intentGroupID = intentGroupID
    this.quoteID = quoteID
    this.hash = hash

    this.route = new RouteDataModel({
      salt,
      source,
      destination,
      inbox: getAddress(inbox),
      routeTokens: routeTokens.map((token) => {
        token.token = getAddress(token.token)
        return token
      }),
      calls: calls.map((call) => {
        call.target = getAddress(call.target)
        return call
      }),
      deadline: routeDeadline,
      portal: inbox,
      nativeAmount: nativeValue,
    })

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
    return hashIntent(intentDataModel)
  }

  static encode(intentDataModel: IntentDataModel) {
    return encodeIntent(intentDataModel)
  }

  static fromEvent(
    sourceChainID: bigint,
    logIndex: number,
    event: IntentCreatedEventLog,
    route: V2RouteType,
  ): IntentDataModel {
    const e = event.args

    return new IntentDataModel({
      hash: e.intentHash,
      salt: route.salt,
      source: sourceChainID,
      destination: e.destination,
      inbox: route.portal, // portal
      routeTokens: route.tokens as Mutable<typeof route.tokens>,
      calls: route.calls as Mutable<typeof route.calls>,
      creator: e.creator,
      prover: e.prover,
      deadline: e.rewardDeadline,
      routeDeadline: route.deadline,
      nativeValue: e.rewardNativeAmount,
      rewardTokens: e.rewardTokens as Mutable<typeof e.rewardTokens>,
      logIndex,
    })
  }

  static toChainIntent(intent: IntentDataModel): IntentType {
    return {
      route: intent.route,
      reward: intent.reward,
    }
  }

  static toIntentV2(intent: IntentDataModel): IntentV2 {
    const { route, reward } = intent

    return {
      source: route.source,
      destination: route.destination,
      route: {
        salt: route.salt,
        deadline: route.deadline,
        portal: route.portal,
        nativeAmount: route.nativeAmount,
        tokens: route.tokens,
        calls: route.calls,
      },
      reward: {
        creator: reward.creator,
        prover: reward.prover,
        deadline: reward.deadline,
        nativeAmount: reward.nativeValue,
        tokens: reward.tokens,
      },
    }
  }
}

export const IntentSourceDataSchema = SchemaFactory.createForClass(IntentDataModel)
IntentSourceDataSchema.index({ intentGroupID: 1 }, { unique: false })
IntentSourceDataSchema.index({ quoteID: 1 }, { unique: false })
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
