import { deserializeUnchecked, Schema, serialize } from 'borsh'

export class SerializableAccountMeta {
  pubkey!: Uint8Array
  is_signer!: number
  is_writable!: number
}

export class SvmCallData {
  instruction_data!: Uint8Array
  num_account_metas!: number

  static deserialize(data: Buffer): SvmCallData {
    return deserializeUnchecked(svmCallSchema, SvmCallData, data)
  }

  // equivalent of Rust's "to_bytes()", which returns Borsh-encoded Buffer
  toBytes(): Buffer {
    return Buffer.from(serialize(svmCallSchema, this))
  }
}

export class SvmCallDataWithMetas {
  svm_call_data!: SvmCallData
  account_metas!: SerializableAccountMeta[]

  static deserialize(data: Buffer): SvmCallDataWithMetas {
    return deserializeUnchecked(svmCallWithMetasSchema, SvmCallDataWithMetas, data)
  }
}

export const svmCallSchema: Schema = new Map([
  [
    SvmCallData,
    {
      kind: 'struct',
      fields: [
        ['instruction_data', ['u8']],
        ['num_account_metas', 'u8'],
      ],
    },
  ],
])

export const svmCallWithMetasSchema: Schema = new Map([
  ...svmCallSchema,
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
  [
    SvmCallDataWithMetas,
    {
      kind: 'struct',
      fields: [
        ['svm_call_data', SvmCallData],
        ['account_metas', [SerializableAccountMeta]],
      ],
    },
  ],
])

//  equivalent of the on-chain's 'from_calldata_without_account_metas' functino
export function stripMetas(data: Buffer): SvmCallData {
  const wrapper = SvmCallDataWithMetas.deserialize(data)

  if (wrapper.svm_call_data.num_account_metas === 0) {
    throw new Error('Invalid fulfill-call (num_account_metas == 0)')
  }

  return wrapper.svm_call_data
}
