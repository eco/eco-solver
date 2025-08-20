import { Hex } from "viem"

export interface RewardInterface {
  creator: Hex
  prover: Hex
  deadline: bigint
  nativeValue: bigint
  tokens: ReadonlyArray<{ token: Hex; amount: bigint }>
}
