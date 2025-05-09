import { deserializeUnchecked, Schema, serialize } from 'borsh'

export class SerializableAccountMeta {
  pubkey!: Uint8Array
  is_signer!: number
  is_writable!: number
}

export class SvmCallData {
  instruction_data!: Uint8Array
  num_account_metas!: number
  account_metas!: SerializableAccountMeta[]

  static deserialize(data: Buffer): SvmCallData {
    return deserializeUnchecked(svmCallSchema, SvmCallData, data)
  }

  /**
   * Return a clone with the same instruction data / counters,
   * but account_metas = [] (mirroring the on-chain helper)
   */
  static fromCalldataWithoutAccountMeta(data: Buffer): SvmCallData {
    const full = SvmCallData.deserialize(data)

    if (full.num_account_metas === 0) {
      throw new Error('Invalid fulfill-call (num_account_metas == 0)')
    }

    const stripped = new SvmCallData()
    stripped.instruction_data = full.instruction_data
    stripped.num_account_metas = full.num_account_metas
    stripped.account_metas = []
    return stripped
  }

  // equivalent of Rust's "to_bytes()", which returns Borsh-encoded Buffer
  toBytes(): Buffer {
    return Buffer.from(serialize(svmCallSchema, this))
  }
}

export const svmCallSchema: Schema = new Map<any, any>([
  [
    SvmCallData,
    {
      kind: 'struct',
      fields: [
        ['instruction_data', ['u8']],
        ['num_account_metas', 'u8'],
        ['account_metas', [SerializableAccountMeta]],
      ],
    },
  ],
  [
    SerializableAccountMeta,
    {
      kind: 'struct',
      fields: [
        ['pubkey', [32]],
        ['is_signer', 'u8'],
        ['is_writable', 'u8'],
      ],
    },
  ],
])
