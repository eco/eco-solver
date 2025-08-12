import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Hex } from 'viem'

@Schema({ _id: false })
export class ParsedERC20CallModel {
  @Prop({ required: true, type: String })
  token: Hex

  @Prop({ required: true, type: BigInt })
  amount: bigint

  @Prop({ required: true, type: String })
  recipient: Hex

  @Prop({ required: true, type: BigInt })
  value: bigint
}

@Schema({ _id: false })
export class ParsedNativeCallModel {
  @Prop({ required: true, type: String })
  recipient: Hex

  @Prop({ required: true, type: BigInt })
  value: bigint
}

@Schema({ _id: false })
export class ParsedCallsModel {
  @Prop({ required: true, type: [ParsedERC20CallModel] })
  erc20Calls: ParsedERC20CallModel[]

  @Prop({ required: true, type: [ParsedNativeCallModel] })
  nativeCalls: ParsedNativeCallModel[]
}

export const ParsedERC20CallSchema = SchemaFactory.createForClass(ParsedERC20CallModel)
export const ParsedNativeCallSchema = SchemaFactory.createForClass(ParsedNativeCallModel)
export const ParsedCallsSchema = SchemaFactory.createForClass(ParsedCallsModel)

// Add indexes for efficient querying
ParsedERC20CallSchema.index({ token: 1 }, { unique: false })
ParsedERC20CallSchema.index({ recipient: 1 }, { unique: false })
ParsedERC20CallSchema.index({ token: 1, recipient: 1 }, { unique: false })

ParsedNativeCallSchema.index({ recipient: 1 }, { unique: false })