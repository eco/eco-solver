import { BatchWithdraws, BatchWithdrawGasless } from '@/indexer/interfaces/batch-withdraws.interface'

export function isGaslessIntent(
  record: BatchWithdraws | BatchWithdrawGasless,
): record is BatchWithdrawGasless {
  return 'intentHash' in record.intent
}