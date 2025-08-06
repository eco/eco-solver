import { Hex } from 'viem'
import { IntentType, RewardType, RouteType, VmType } from '@eco-foundation/routes-ts'

import { IndexerIntent } from '@/indexer/interfaces/intent.interface'

export function getWithdrawData(intent: IndexerIntent): IntentType {
  const reward: RewardType = {
    vm: VmType.EVM,
    creator: intent.creator as Hex,
    prover: intent.prover as Hex,
    deadline: BigInt(intent.deadline),
    nativeAmount: BigInt(intent.nativeValue),
    tokens: intent.rewardTokens.map(({ token, amount }) => ({
      token: token as Hex,
      amount: BigInt(amount),
    })),
  }

  const route: RouteType = {
    vm: VmType.EVM,
    salt: intent.salt as Hex,
    deadline: BigInt(intent.deadline),
    portal: intent.inbox as Hex,
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

  return { source: BigInt(intent.source), destination: BigInt(intent.destination), reward, route }
}
