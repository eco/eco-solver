import { Hex, decodeAbiParameters } from 'viem'

import { IndexerIntent } from '@/indexer/interfaces/intent.interface'
import { PortalHashUtils } from '@/common/utils/portal'
import { routeStructAbiItem, V2RouteType } from '@/contracts'

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
  // Build Reward in Portal (v2) shape; support new field names
  const reward = {
    creator: intent.creator as Hex,
    prover: intent.prover as Hex,
    deadline: BigInt(intent.rewardDeadline),
    nativeAmount: BigInt(intent.rewardNativeAmount),
    tokens: intent.rewardTokens.map(({ token, amount }) => ({
      token: token as Hex,
      amount: BigInt(amount),
    })),
  }

  // Build Route struct from either encoded bytes or legacy fields
  const route: V2RouteType = decodeAbiParameters(
    [routeStructAbiItem],
    intent.route as Hex,
  )[0] as V2RouteType

  const { routeHash } = PortalHashUtils.getIntentHash({
    destination: BigInt(intent.destination),
    route,
    reward,
  })

  return { destination: BigInt(intent.destination), routeHash, reward }
}
