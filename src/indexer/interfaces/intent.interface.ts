export interface IndexerIntent {
  hash: string
  creator: string
  prover: string
  salt: string
  source: string
  destination: string
  inbox: string
  routeTokens: {
    token: string
    amount: string
  }[]
  calls: {
    target: string
    data: string
    value: string
  }[]
  deadline: string
  nativeValue: string
  rewardTokens: {
    token: string
    amount: string
  }[]
}
