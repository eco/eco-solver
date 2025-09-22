import { Hex } from 'viem'

import { IndexerIntent } from '@/indexer/interfaces/intent.interface'
import { PortalHashUtils } from '@/common/utils/portal'

export type WithdrawData = {
  destination: bigint
  routeHash: Hex
  reward: {
    creator: Hex
    prover: Hex
    deadline: bigint
    nativeAmount: bigint
    tokens: { token: Hex; amount: bigint }[]
  }
}

export function getWithdrawData(intent: IndexerIntent): WithdrawData {
  // Build Reward in Portal (v2) shape
  const reward = {
    creator: intent.creator as Hex,
    prover: intent.prover as Hex,
    deadline: BigInt(intent.deadline),
    nativeAmount: BigInt(intent.nativeValue),
    tokens: intent.rewardTokens.map(({ token, amount }) => ({
      token: token as Hex,
      amount: BigInt(amount),
    })),
  }

  // Build Route in Portal (v2) shape to compute routeHash
  const route = {
    salt: intent.salt as Hex,
    deadline: BigInt(intent.deadline),
    portal: intent.inbox as Hex,
    nativeAmount: BigInt(intent.nativeValue),
    tokens: intent.routeTokens.map(({ token, amount }) => ({
      token: token as Hex,
      amount: BigInt(amount),
    })),
    calls: intent.calls.map((call) => ({
      data: call.data as Hex,
      target: call.target as Hex,
      value: BigInt(call.value),
    })),
  }

  const { routeHash } = PortalHashUtils.getIntentHash({
    destination: BigInt(intent.destination),
    route,
    reward,
  })

  return { destination: BigInt(intent.destination), routeHash, reward }
}
