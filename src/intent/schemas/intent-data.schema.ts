import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '@/common/errors/eco-error'
import { getAddress, Hex, Mutable } from 'viem'
import { IntentCreatedEventLog, CallDataInterface, RewardTokensInterface } from '@/contracts'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { encodeIntent, hashIntent, IntentType } from '@eco-foundation/routes-ts'
import { denormalizeTokenAmounts } from '@/intent/utils/intent-denormalization.utils'
import { ParsedCallsModel } from '@/intent/schemas/parsed-calls.schema'

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
  deadline: bigint
  nativeValue: bigint
  rewardTokens: RewardTokensInterface[]
  logIndex: number
  funder?: Hex
  parsedCalls?: ParsedCallsModel
}

@Schema({ timestamps: true })
export class IntentDataModel implements IntentType {
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
      nativeValue,
      rewardTokens,
      logIndex,
      funder,
      parsedCalls,
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

    // Create empty parsedCalls if not provided - will be set later by the calling service
    const defaultParsedCalls = parsedCalls || { erc20Calls: [], nativeCalls: [] }

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
      defaultParsedCalls,
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
    return hashIntent(intentDataModel.toDenormalizedIntent())
  }

  static encode(intentDataModel: IntentDataModel) {
    return encodeIntent(intentDataModel.toDenormalizedIntent())
  }

  static fromEvent(event: IntentCreatedEventLog, logIndex: number): IntentDataModel {
    const e = event.args
    return new IntentDataModel({
      hash: e.hash,
      salt: e.salt,
      source: e.source,
      destination: e.destination,
      inbox: e.inbox,
      routeTokens: e.routeTokens as Mutable<typeof e.routeTokens>,
      calls: e.calls as Mutable<typeof e.calls>,
      creator: e.creator,
      prover: e.prover,
      deadline: e.deadline,
      nativeValue: e.nativeValue,
      rewardTokens: e.rewardTokens as Mutable<typeof e.rewardTokens>,
      logIndex,
    })
  }

  static toChainIntent(intent: IntentDataModel): IntentType {
    // Convert Mongoose document to plain object if needed
    const plainIntent = (intent as any).toObject ? (intent as any).toObject() : intent
    
    return {
      route: {
        ...plainIntent.route,
        tokens: denormalizeTokenAmounts(plainIntent.route?.tokens || [], Number(plainIntent.route.destination)),
      },
      reward: {
        ...plainIntent.reward,
        tokens: denormalizeTokenAmounts(plainIntent.reward?.tokens || [], Number(plainIntent.route.source)),
      },
    }
  }

  /**
   * Returns a denormalized copy of this intent for hashing and encoding operations.
   * This ensures that token amounts are in their original decimals for consistent hashing.
   */
  toDenormalizedIntent(): IntentType {
    return IntentDataModel.toChainIntent(this)
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
  return hashIntent(this.toDenormalizedIntent())
}

IntentSourceDataSchema.methods.getEncoding = function (): Hex {
  return encodeIntent(this.toDenormalizedIntent())
}

IntentSourceDataSchema.methods.toDenormalizedIntent = function (): IntentType {
  return IntentDataModel.toChainIntent(this)
}
