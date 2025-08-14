import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { now } from 'mongoose'
import { AtomicKeyParams, getAtomicNonceVals } from '../utils/nonce.utils'
import { Hex } from 'viem'

@Schema({ timestamps: true })
export class Nonce {
  @Prop({ required: true, unique: true })
  key: string

  @Prop({ required: true, default: 0 })
  nonce: number

  @Prop({ required: true })
  chainID: number

  @Prop({ required: true })
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
