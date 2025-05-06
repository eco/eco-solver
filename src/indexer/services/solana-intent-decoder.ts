import { PublicKey } from '@solana/web3.js'
import { IndexerIntent } from '@/indexer/interfaces/intent.interface'
import { deserializeUnchecked, Schema as BorshSchema } from 'borsh'

class TokenAmount {
  token!: Uint8Array
  amount!: bigint
}

class Call {
  destination!: Uint8Array
  calldata!: Uint8Array
}

class Route {
  salt!: Uint8Array
  source_domain_id!: number
  destination_domain_id!: number
  inbox!: Uint8Array
  tokens!: TokenAmount[]
  calls!: Call[]
}

class Reward {
  creator!: Uint8Array
  tokens!: TokenAmount[]
  prover!: Uint8Array
  native_amount!: bigint
  deadline!: bigint
}

class IntentRaw {
  intent_hash!: Uint8Array
  status!: number
  route!: Route
  reward!: Reward
  tokens_funded!: number
  native_funded!: number
  solver!: Uint8Array
  bump!: number
}

const schema: BorshSchema = new Map<any, any>([
  [
    TokenAmount,
    {
      kind: 'struct',
      fields: [
        ['token', [32]],
        ['amount', 'u64'],
      ],
    },
  ],
  [
    Call,
    {
      kind: 'struct',
      fields: [
        ['destination', [32]],
        ['calldata', ['u8']],
      ],
    },
  ],
  [
    Route,
    {
      kind: 'struct',
      fields: [
        ['salt', [32]],
        ['source_domain_id', 'u32'],
        ['destination_domain_id', 'u32'],
        ['inbox', [32]],
        ['tokens', [TokenAmount]],
        ['calls', [Call]],
      ],
    },
  ],
  [
    Reward,
    {
      kind: 'struct',
      fields: [
        ['creator', [32]],
        ['tokens', [TokenAmount]],
        ['prover', [32]],
        ['native_amount', 'u64'],
        ['deadline', 'i64'],
      ],
    },
  ],
  [
    IntentRaw,
    {
      kind: 'struct',
      fields: [
        ['intent_hash', [32]],
        ['status', 'u8'],
        ['route', Route],
        ['reward', Reward],
        ['tokens_funded', 'u8'],
        ['native_funded', 'u8'],
        ['solver', [32]],
        ['bump', 'u8'],
      ],
    },
  ],
])

const INTENT_DISCRIMINATOR = Buffer.from('f7a223a5fe6f816d', 'hex')

export function decodeIntentAccount(pda: PublicKey, data: Buffer): IndexerIntent {
  if (!data.subarray(0, 8).equals(INTENT_DISCRIMINATOR)) {
    throw new Error('Account is not an Intent')
  }

  const raw: IntentRaw = deserializeUnchecked(schema, IntentRaw, data.subarray(8))

  const hex32 = (u8: Uint8Array) => '0x' + Buffer.from(u8).toString('hex')

  return {
    hash: hex32(raw.intent_hash),
    creator: hex32(raw.reward.creator),
    prover: hex32(raw.reward.prover),
    salt: hex32(raw.route.salt),
    source: raw.route.source_domain_id.toString(),
    destination: raw.route.destination_domain_id.toString(),
    inbox: hex32(raw.route.inbox),
    routeTokens: raw.route.tokens.map((t) => ({
      token: hex32(t.token),
      amount: t.amount.toString(),
    })),
    calls: raw.route.calls.map((c) => ({
      target: hex32(c.destination),
      data: '0x' + Buffer.from(c.calldata).toString('hex'),
      value: '0',
    })),
    deadline: raw.reward.deadline.toString(),
    nativeValue: raw.reward.native_amount.toString(),
    rewardTokens: raw.reward.tokens.map((t) => ({
      token: hex32(t.token),
      amount: t.amount.toString(),
    })),
  }
}
