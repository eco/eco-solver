import { IndexerIntent } from '@/indexer/interfaces/intent.interface'

export interface BatchWithdraws {
  intent: IndexerIntent
  claimant: {
    _hash: string
    _claimant: string
  }
}
