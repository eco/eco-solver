export interface IndexerIntent {
  // V2 fields
  intentHash: string
  creator: string
  prover: string
  destination: string
  route: string // bytes-encoded Route struct
  rewardDeadline: string
  rewardNativeAmount: string
  rewardTokens: {
    token: string
    amount: string
  }[]
}
