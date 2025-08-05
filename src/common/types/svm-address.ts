import { PublicKey } from '@solana/web3.js'

export class SvmAddress {
  constructor(private readonly _pubkey: PublicKey) {}

  static from(input: string | PublicKey): SvmAddress {
    return new SvmAddress(input instanceof PublicKey ? input : new PublicKey(input))
  }

  get publicKey(): PublicKey {
    return this._pubkey
  }

  toString(): string {
    return this._pubkey.toString()
  }

  valueOf(): string {
    return this._pubkey.toString()
  }

  [Symbol.toPrimitive](): string {
    return this._pubkey.toString()
  }
}