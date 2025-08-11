import { IndexerIntent } from './indexer-intent.interface'

export interface BatchWithdraws {
  intent: IndexerIntent
  claimant: {
    _hash: string
    _claimant: string
  }
}

export interface BatchWithdrawGasless {
  intent: {
    intentHash: string
    fundingSource: string
  }
  claimant: {
    _hash: string
    _claimant: string
  }
}