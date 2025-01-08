import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { EcoError } from '../../common/errors/eco-error'
import { DecodeEventLogReturnType, getAddress, Hex } from 'viem'
import { IntentSource, IntentSourceViemType } from '../../contracts'

@Schema({ timestamps: true })
export class IntentSourceDataModel implements IntentSourceViemType {
  @Prop({ required: true })
  hash: Hex
  @Prop({ required: true })
  creator: Hex
  @Prop({ required: true })
  destinationChainID: bigint
  @Prop({ required: true })
  targets: Hex[]
  @Prop({ required: true })
  data: Hex[]
  @Prop({ required: true })
  rewardTokens: Hex[]
  @Prop({ required: true })
  rewardAmounts: bigint[]
  @Prop({ required: true })
  expiryTime: bigint
  @Prop({ required: true })
  isActive: boolean
  @Prop({ required: true })
  nonce: Hex
  @Prop({ required: true })
  prover: Hex
  @Prop({ required: true })
  rewardNative: bigint
  @Prop({ required: true })
  logIndex: number

  constructor(
    hash: Hex,
    creator: Hex,
    destinationChain: bigint,
    targets: readonly Hex[],
    data: readonly Hex[],
    rewardTokens: readonly Hex[],
    rewardAmounts: readonly bigint[],
    expiryTime: bigint,
    nonce: Hex,
    prover: Hex,
    rewardNative: bigint,
    logIndex: number,
  ) {
    if (targets.length !== data.length) {
      throw EcoError.IntentSourceDataInvalidParams
    }
    this.hash = hash
    this.creator = creator
    this.destinationChainID = destinationChain
    this.targets = targets.map((target) => getAddress(target))
    this.data = data.map((d) => d)
    this.rewardTokens = rewardTokens.map((token) => getAddress(token as string))
    this.rewardAmounts = rewardAmounts.map((amount) => amount)
    this.expiryTime = expiryTime
    this.isActive = true
    this.nonce = nonce
    this.prover = getAddress(prover as string)
    this.rewardNative = rewardNative
    this.logIndex = logIndex
  }

  static fromEvent(
    event: DecodeEventLogReturnType<IntentSource, 'IntentCreated'>,
    logIndex: number,
  ): IntentSourceDataModel {
    const e = event.args
    return new IntentSourceDataModel(
      e._hash,
      e._creator,
      e._destinationChain,
      e._targets,
      e._data,
      e._rewardTokens,
      e._rewardAmounts,
      e._expiryTime,
      e.nonce,
      e._prover,
      e._rewardNative,
      logIndex,
    )
  }
}

export const IntentSourceDataSchema = SchemaFactory.createForClass(IntentSourceDataModel)
IntentSourceDataSchema.index({ hash: 1 }, { unique: true })
IntentSourceDataSchema.index(
  { hasBeenWithdrawn: 1, destinationChain: 'ascending', expiryTime: 'ascending' },
  { unique: false },
)
