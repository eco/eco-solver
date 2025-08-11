import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '@/common/errors/eco-error'
import { getAddress, Hex, Mutable } from 'viem'
import { IntentCreatedEventLog, CallDataInterface, RewardTokensInterface } from '@/contracts'
import { RouteDataModel, RouteDataSchema } from '@/intent/schemas/route-data.schema'
import { RewardDataModel, RewardDataModelSchema } from '@/intent/schemas/reward-data.schema'
import { encodeIntent, hashIntent, IntentType, RewardType } from '@eco-foundation/routes-ts'
import { getChainAddress } from '@/eco-configs/utils'
import { getVmType, VmType } from '@/eco-configs/eco-config.types'

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

  @Prop({ required: true, type: BigInt })
  source: bigint
  @Prop({ required: true, type: BigInt })
  destination: bigint

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
    } = params

    const sourceVmType = getVmType(Number(source))
    const destinationVmType = getVmType(Number(destination))

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
      destinationVmType,
      salt,
      deadline,
      source,
      destination,
      getAddress(inbox),
      routeTokens.map((token) => {
        token.token = getChainAddress(destination, token.token).toString() as `0x${string}`;
        return token
      }),
      calls.map((call) => {
        call.target = getChainAddress(destination, call.target).toString() as `0x${string}`;
        return call
      }) as any,
    )

    
    this.reward = new RewardDataModel(
      sourceVmType,
      getChainAddress(source, creator).toString() as `0x${string}`,
      getChainAddress(source, prover).toString() as `0x${string}`,
      deadline,
      nativeValue,
      rewardTokens.map((token) => {
        token.token = getChainAddress(source, token.token).toString() as `0x${string}`;
        return token
      }),
    )

    this.logIndex = logIndex
    this.funder = funder

    this.destination = destination
    this.source = source
  }

  static isNativeIntent(params: CreateIntentDataModelParams): boolean {
    return (
      params.calls.some((call) => {
        return call.value > 0
      }) || params.nativeValue > 0
    )
  }

  static getHash(intentDataModel: IntentDataModel) {
    if (intentDataModel.route.source === 1399811150n || intentDataModel.route.destination === 1399811150n) {
      console.log("JUSTLOGGING: intent.getHash()", intentDataModel)
    }
    return hashIntent(intentDataModel.route.destination, intentDataModel.route, intentDataModel.reward) 
  }

  static encode(intentDataModel: IntentDataModel) {
    if (intentDataModel.route.source === 1399811150n || intentDataModel.route.destination === 1399811150n) {
      console.log("JUSTLOGGING: intent.encode()", intentDataModel)
    }
    return encodeIntent(intentDataModel.route.destination, intentDataModel.route, intentDataModel.reward) 
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
    return {
      destination: intent.route.destination,
      source: intent.route.source,
      route: {
        ...intent.route,
        vm: VmType.EVM,
        deadline: intent.reward.deadline,

        portal: intent.route.portal,
      },
      reward: intent.reward,

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
