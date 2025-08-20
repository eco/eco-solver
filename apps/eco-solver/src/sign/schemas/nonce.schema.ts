import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { now } from 'mongoose'
import { AtomicKeyParams } from '../atomic.nonce.service'
import { Hex } from 'viem'
import { getAtomicNonceVals } from '../sign.helper'

@Schema({ timestamps: true })
export class Nonce {
  @Prop({ required: true, unique: true })
  key: string

  @Prop({ required: true, default: 0 })
  nonce: number

  @Prop({ required: true })
  chainID: number

  @Prop({ required: true, type: String })
  address: Hex

  @Prop({ required: true, default: now() })
  createdAt: Date

  @Prop({ required: true, default: now() })
  updatedAt: Date

  toString(): string {
    return `${this.key}:${this.nonce}`
  }

  getAtomicNonceVals(): AtomicKeyParams {
    return getAtomicNonceVals(this.key)
  }
}

export const NonceSchema = SchemaFactory.createForClass(Nonce)
